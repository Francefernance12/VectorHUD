import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FolderOpen, Edit3, Database, Plus, Trash2, Loader2, CheckSquare, Save, ChevronDown, ChevronRight, Check, RefreshCw } from 'lucide-react';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../types';
import { getDb } from '../../utils/db';
import { useNotionStore } from '../../store/notionStore';

interface NotionNote {
  id: string;
  title: string;
  description: string;
  status: string;
  date: string;
}

interface NotionBlock {
  id: string;
  b_type: string;
  task_text: string;
  checked: boolean;
}

export function NotionCaptureWidget() {
  const { 
    draft, updateDraft, clearDraft, 
    activeTab, setActiveTab,
    notes, setNotes,
    expandedNoteId, setExpandedNoteId,
    noteBlocks, setNoteBlocks
  } = useNotionStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [schemaEnsured, setSchemaEnsured] = useState(false);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState<Record<string, boolean>>({});
  
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTasks, setEditTasks] = useState<string[]>([]);
  const [isEditingLoading, setIsEditingLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'notes') {
      fetchNotes();
    }
  }, [activeTab]);

  const getNotionCreds = async () => {
    const db = await getDb();
    const secretRes = await db.select<{ encrypted_value: string }[]>("SELECT encrypted_value FROM user_credentials WHERE id = 'notion_secret'");
    const dbIdRes = await db.select<{ encrypted_value: string }[]>("SELECT encrypted_value FROM user_credentials WHERE id = 'notion_db_id'");

    if (secretRes.length > 0 && dbIdRes.length > 0) {
      const token = await invoke<string>('decrypt_data', { encoded: secretRes[0].encrypted_value });
      const dbId = await invoke<string>('decrypt_data', { encoded: dbIdRes[0].encrypted_value });
      if (token && dbId) {
        return { token, dbId };
      }
    }
    throw new Error("API keys missing.");
  };

  const fetchNotes = async () => {
    setIsLoadingNotes(true);
    setStatusMsg(null);
    try {
      const creds = await getNotionCreds();
      
      if (!schemaEnsured) {
        await invoke('ensure_notion_schema', { token: creds.token, dbId: creds.dbId }).catch(e => {
            logger.warn(`Failed to ensure schema: ${e}`);
        });
        setSchemaEnsured(true);
      }

      const fetchedNotes = await invoke<NotionNote[]>('fetch_notion_notes', { token: creds.token, dbId: creds.dbId });
      setNotes(fetchedNotes);
    } catch (err) {
      const msg = getErrorMessage(err);
      logger.error(`Failed to fetch notes: ${msg}`);
      setStatusMsg(`Err: ${msg}`);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  const handleSyncToNotion = async () => {
    if (!draft.title.trim() && !draft.description.trim() && !draft.content.trim() && draft.tasks.filter(t => t.trim()).length === 0) return;
    
    setIsSubmitting(true);
    setStatusMsg('SYNC_IN_PROGRESS...');

    try {
      const creds = await getNotionCreds();
      
      if (!schemaEnsured) {
         await invoke('ensure_notion_schema', { token: creds.token, dbId: creds.dbId }).catch(() => {});
         setSchemaEnsured(true);
      }

      await invoke('sync_to_notion', { 
        title: draft.title.trim(), 
        description: draft.description.trim(),
        content: draft.content.trim(),
        tasks: draft.tasks.filter(t => t.trim() !== ''),
        token: creds.token, 
        dbId: creds.dbId 
      });
      
      clearDraft();
      setStatusMsg('SYNC_COMPLETE');
      logger.info('Notion sync successful');
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      logger.error(`Notion sync failed: ${msg}`);
      setStatusMsg(`SYNC_FAIL: ${msg}`);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };
  
  const handleSaveLocal = async () => {
    if (!draft.title.trim() && !draft.description.trim() && !draft.content.trim() && draft.tasks.filter(t => t.trim()).length === 0) return;
    try {
        const localBody = `TITLE: ${draft.title}\nDESCRIPTION: ${draft.description}\nCONTENT:\n${draft.content}\nTASKS:\n${draft.tasks.map(t => `- [ ] ${t}`).join('\n')}`;
        await invoke('save_local_note', { note: localBody });
        setStatusMsg('LOCAL_SAVE_OK');
        setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
        setStatusMsg('LOCAL_SAVE_FAIL');
    }
  };

  // Interactive Database Functions
  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
        const creds = await getNotionCreds();
        await invoke('delete_notion_note', { token: creds.token, pageId: id });
        setNotes(notes.filter(n => n.id !== id));
        logger.info(`Archived note ${id}`);
    } catch (err) {
        logger.error(`Failed to delete note: ${getErrorMessage(err)}`);
    }
  };

  const handleUpdateNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
        const creds = await getNotionCreds();
        await invoke('update_notion_page_full', { 
            token: creds.token, 
            pageId: id,
            title: editTitle,
            description: editDesc,
            content: editContent,
            tasks: editTasks
        });
        setNotes(notes.map(n => n.id === id ? { ...n, title: editTitle, description: editDesc } : n));
        setEditingNoteId(null);
        // Refresh blocks just in case
        const blocks = await invoke<NotionBlock[]>('fetch_notion_blocks', { token: creds.token, blockId: id });
        setNoteBlocks({ ...noteBlocks, [id]: blocks });
        logger.info(`Updated note ${id}`);
    } catch (err) {
        logger.error(`Failed to update note: ${getErrorMessage(err)}`);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    try {
        const creds = await getNotionCreds();
        await invoke('update_notion_status', { token: creds.token, pageId: id, status: newStatus });
        setNotes(notes.map(n => n.id === id ? { ...n, status: newStatus } : n));
        logger.info(`Updated status for note ${id} to ${newStatus}`);
    } catch (err) {
        logger.error(`Failed to update status: ${getErrorMessage(err)}`);
    }
  };

  const handleEditClick = async (note: NotionNote, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(note.title);
    setEditDesc(note.description);
    setEditingNoteId(note.id);
    setExpandedNoteId(note.id);
    setIsEditingLoading(true);
    setEditContent('');
    setEditTasks([]);

    try {
        const creds = await getNotionCreds();
        const blocks = await invoke<NotionBlock[]>('fetch_notion_blocks', { token: creds.token, blockId: note.id });
        const contentStr = blocks.filter(b => b.b_type === 'paragraph').map(b => b.task_text).join('\n');
        const tasksArr = blocks.filter(b => b.b_type === 'to_do').map(b => b.task_text);
        setEditContent(contentStr);
        setEditTasks(tasksArr);
    } catch (err) {
        logger.error(`Failed to fetch blocks for editing: ${getErrorMessage(err)}`);
    } finally {
        setIsEditingLoading(false);
    }
  };

  const toggleExpandNote = async (id: string) => {
    if (expandedNoteId === id) {
        setExpandedNoteId(null);
        return;
    }
    setExpandedNoteId(id);
    if (!noteBlocks[id]) {
        setIsLoadingBlocks(prev => ({ ...prev, [id]: true }));
        try {
            const creds = await getNotionCreds();
            const blocks = await invoke<NotionBlock[]>('fetch_notion_blocks', { token: creds.token, blockId: id });
            setNoteBlocks({ ...noteBlocks, [id]: blocks });
        } catch (err) {
            logger.error(`Failed to fetch blocks: ${getErrorMessage(err)}`);
        } finally {
            setIsLoadingBlocks(prev => ({ ...prev, [id]: false }));
        }
    }
  };

  const toggleTaskBlock = async (pageId: string, blockId: string, currentChecked: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
        const creds = await getNotionCreds();
        await invoke('toggle_notion_task', { token: creds.token, blockId, checked: !currentChecked });
        const updated = noteBlocks[pageId].map(b => b.id === blockId ? { ...b, checked: !currentChecked } : b);
        setNoteBlocks({ ...noteBlocks, [pageId]: updated });
    } catch (err) {
        logger.error(`Failed to toggle task: ${getErrorMessage(err)}`);
    }
  };

  const updateTask = (index: number, val: string) => {
    const newTasks = [...draft.tasks];
    newTasks[index] = val;
    updateDraft({ tasks: newTasks });
  };

  const addTask = () => {
    updateDraft({ tasks: [...draft.tasks, ''] });
  };

  const removeTask = (index: number) => {
    const newTasks = draft.tasks.filter((_, i) => i !== index);
    if (newTasks.length === 0) newTasks.push('');
    updateDraft({ tasks: newTasks });
  };

  return (
    <div className="flex flex-col h-full text-zinc-300 font-mono p-4 bg-black/60 relative group">
      
      {/* HEADER TABS */}
      <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setActiveTab('draft')}
            className={`flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase transition-all ${activeTab === 'draft' ? 'text-accent-amber drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            <Edit3 size={12} /> DATALINK_DRAFT
          </button>
          <button 
            onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase transition-all ${activeTab === 'notes' ? 'text-accent-amber drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            <Database size={12} /> DATABASE_VIEW
          </button>
        </div>
        
        <div className="flex items-center gap-3">
           {statusMsg && (
            <span className={`text-[9px] px-2 py-0.5 border font-bold uppercase tracking-widest animate-pulse ${statusMsg.includes('FAIL') || statusMsg.includes('Err') ? 'text-red-400 border-red-500/30 bg-red-500/10' : 'text-accent-green border-accent-green/30 bg-accent-green/10'}`}>
              {statusMsg}
            </span>
          )}
          {activeTab === 'notes' && (
            <button 
              onClick={fetchNotes}
              className="text-zinc-500 hover:text-accent-green transition-colors p-1.5 rounded hover:bg-white/5 opacity-0 group-hover:opacity-100"
              title="Refresh Database"
            >
              <RefreshCw size={14} className={isLoadingNotes ? 'animate-spin text-accent-green' : ''} />
            </button>
          )}
          <button 
            onClick={() => invoke('open_notes_folder')}
            className="text-zinc-500 hover:text-accent-amber transition-colors p-1.5 rounded hover:bg-white/5 opacity-0 group-hover:opacity-100"
            title="Open local notes folder"
          >
            <FolderOpen size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'draft' ? (
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 pb-2">
            
            {/* Title Input */}
            <div className="flex flex-col gap-1.5 group/field">
              <label className="text-[9px] text-zinc-600 font-bold tracking-widest uppercase group-focus-within/field:text-accent-amber transition-colors">
                DOCUMENT_TITLE
              </label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => updateDraft({ title: e.target.value })}
                placeholder="UNTITLED_ENTRY"
                className="bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent-amber/50 focus:bg-zinc-800 transition-all font-bold placeholder:text-zinc-700"
              />
            </div>

            {/* Description Input */}
            <div className="flex flex-col gap-1.5 group/field">
              <label className="text-[9px] text-zinc-600 font-bold tracking-widest uppercase group-focus-within/field:text-accent-amber transition-colors">
                DESCRIPTION_PAYLOAD
              </label>
              <input
                type="text"
                value={draft.description}
                onChange={(e) => updateDraft({ description: e.target.value })}
                placeholder="Optional short summary..."
                className="bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent-amber/50 focus:bg-zinc-800 transition-all placeholder:text-zinc-700"
              />
            </div>

            {/* Content / Notes Input */}
            <div className="flex flex-col gap-1.5 group/field flex-1">
              <label className="text-[9px] text-zinc-600 font-bold tracking-widest uppercase group-focus-within/field:text-accent-amber transition-colors">
                CONTENT_NOTES
              </label>
              <textarea
                value={draft.content}
                onChange={(e) => updateDraft({ content: e.target.value })}
                placeholder="Enter detailed logs and notes here..."
                className="flex-1 min-h-[80px] bg-zinc-900 border border-zinc-800 rounded-sm p-3 outline-none resize-none focus:border-accent-amber/50 focus:bg-zinc-800 transition-all text-sm custom-scrollbar placeholder:text-zinc-700"
              />
            </div>

            {/* Tasks Array */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-[9px] text-zinc-600 font-bold tracking-widest uppercase">
                  SUB_ROUTINES (TASKS)
                </label>
                <button 
                  onClick={addTask}
                  className="text-[9px] font-bold tracking-widest text-zinc-400 hover:text-accent-green flex items-center gap-1 uppercase"
                >
                  <Plus size={10} /> Add_Routine
                </button>
              </div>
              
              <div className="space-y-2">
                {draft.tasks.map((task, idx) => (
                  <div key={idx} className="flex gap-2 items-center group/task">
                    <div className="w-4 h-4 border border-zinc-700 rounded-sm flex items-center justify-center text-zinc-600">
                      <CheckSquare size={10} />
                    </div>
                    <input
                      type="text"
                      value={task}
                      onChange={(e) => updateTask(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTask();
                        }
                      }}
                      placeholder={`Routine_${idx + 1}`}
                      className="flex-1 bg-zinc-900/50 border-b border-zinc-800 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-accent-amber focus:bg-zinc-800/80 transition-all placeholder:text-zinc-700"
                    />
                    <button
                      onClick={() => removeTask(idx)}
                      className="opacity-0 group-hover/task:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-2 pt-4 border-t border-zinc-800 flex gap-2">
              <button 
                type="button" 
                onClick={handleSyncToNotion}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-accent-amber/10 border border-accent-amber/30 text-accent-amber rounded-sm hover:bg-accent-amber hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed font-bold tracking-widest text-xs uppercase"
              >
                {isSubmitting ? 'TRANSMITTING...' : 'INITIATE_SYNC'}
              </button>
              <button 
                type="button" 
                onClick={handleSaveLocal}
                className="px-4 bg-zinc-900 border border-zinc-700 text-zinc-400 rounded-sm hover:bg-zinc-800 hover:text-zinc-200 transition-all font-bold tracking-widest text-xs uppercase flex items-center justify-center"
                title="Save to local text file without syncing to Notion"
              >
                <Save size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3">
            {isLoadingNotes ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 opacity-50 space-y-3">
                <Loader2 className="animate-spin" size={24} />
                <span className="text-[10px] tracking-widest uppercase font-bold">Querying Database...</span>
              </div>
            ) : notes.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-zinc-600 text-[10px] uppercase tracking-widest font-bold border border-dashed border-zinc-800 m-2">
                NO_RECORDS_FOUND
              </div>
            ) : (
              notes.map(note => (
                <div key={note.id} className="flex flex-col border border-zinc-800 bg-zinc-900/50 rounded-sm group hover:border-zinc-700 transition-colors">
                  <div 
                    onClick={() => toggleExpandNote(note.id)}
                    className="p-3 cursor-pointer flex justify-between items-start gap-3"
                  >
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <div className="mt-0.5 text-zinc-600">
                        {expandedNoteId === note.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        {editingNoteId === note.id ? (
                          <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="bg-black/50 border border-zinc-700 px-2 py-1 text-sm font-bold text-zinc-200 outline-none w-full"
                              placeholder="Title"
                              disabled={isEditingLoading}
                            />
                            <textarea
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              className="bg-black/50 border border-zinc-700 px-2 py-1 text-xs text-zinc-400 outline-none w-full resize-none min-h-[40px] custom-scrollbar"
                              placeholder="Description"
                              disabled={isEditingLoading}
                            />
                            
                          </div>
                        ) : (
                          <>
                            <span className="text-base font-bold text-zinc-100 truncate">{note.title}</span>
                            {note.description && (
                              <span className="text-sm text-zinc-400 line-clamp-2 mt-0.5">{note.description}</span>
                            )}
                            {note.date && (
                              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-2">
                                {new Date(note.date).toLocaleDateString()}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {editingNoteId !== note.id && (
                        <button 
                          onClick={(e) => handleEditClick(note, e)}
                          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-accent-amber transition-all p-1.5 rounded hover:bg-accent-amber/10"
                          title="Edit Note"
                        >
                          <Edit3 size={12} />
                        </button>
                      )}
                      <select 
                        value={note.status}
                        onChange={(e) => handleStatusChange(note.id, e.target.value, e)}
                        onClick={e => e.stopPropagation()}
                        className={`text-[9px] px-1.5 py-1 rounded font-bold uppercase tracking-wider border outline-none cursor-pointer appearance-none ${
                          note.status === 'Done' ? 'bg-accent-green/10 text-accent-green border-accent-green/30' :
                          note.status === 'In progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        <option value="Not started">Not started</option>
                        <option value="In progress">In progress</option>
                        <option value="Done">Done</option>
                      </select>
                      <button 
                        onClick={(e) => handleDeleteNote(note.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-1.5 rounded hover:bg-red-400/10"
                        title="Archive Note"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Area for Tasks */}
                  {expandedNoteId === note.id && (
                    <div className="border-t border-zinc-800 p-4 bg-black/40">
                      <div className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-3">PAGE CONTENTS</div>
                      
                      {editingNoteId === note.id ? (
                        <div className="flex flex-col gap-3 w-full" onClick={e => e.stopPropagation()}>
                           {isEditingLoading ? (
                              <div className="text-sm text-zinc-500 py-2 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Fetching content...</div>
                           ) : (
                             <>
                               <textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  className="bg-black/50 border border-zinc-700 px-3 py-2 text-sm text-zinc-300 outline-none w-full resize-none min-h-[250px] custom-scrollbar leading-relaxed"
                                  placeholder="Content (paragraphs)"
                               />
                               <div className="flex flex-col gap-2 mt-2">
                                  <div className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Tasks</div>
                                  {editTasks.map((t, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                      <input
                                        type="text"
                                        value={t}
                                        onChange={(e) => {
                                          const newTasks = [...editTasks];
                                          newTasks[idx] = e.target.value;
                                          setEditTasks(newTasks);
                                        }}
                                        className="bg-black/50 border border-zinc-800 px-3 py-2 text-sm text-zinc-300 outline-none flex-1"
                                      />
                                      <button 
                                        onClick={() => setEditTasks(editTasks.filter((_, i) => i !== idx))}
                                        className="text-zinc-600 hover:text-red-400 p-2"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  ))}
                                  <button 
                                    onClick={() => setEditTasks([...editTasks, ''])}
                                    className="text-[10px] px-3 py-1.5 bg-white/5 text-zinc-400 border border-white/10 uppercase tracking-widest font-bold self-start mt-1 hover:bg-white/10 hover:text-white transition-colors"
                                  >
                                    + Add Task
                                  </button>
                               </div>
                               
                               <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-zinc-800/50">
                                  <button onClick={(e) => { e.stopPropagation(); setEditingNoteId(null); }} className="text-xs px-4 py-2 bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-colors uppercase tracking-widest font-bold">Cancel</button>
                                  <button onClick={(e) => handleUpdateNote(note.id, e)} disabled={isEditingLoading} className="text-xs px-4 py-2 bg-accent-green/20 text-accent-green border border-accent-green/30 hover:bg-accent-green hover:text-black transition-colors uppercase tracking-widest font-bold disabled:opacity-50">Save Changes</button>
                               </div>
                             </>
                           )}
                        </div>
                      ) : isLoadingBlocks[note.id] ? (
                        <div className="flex items-center gap-2 text-sm text-zinc-500 py-3">
                          <Loader2 size={14} className="animate-spin" /> Fetching blocks...
                        </div>
                      ) : noteBlocks[note.id]?.length > 0 ? (
                        <div className="space-y-2">
                          {noteBlocks[note.id].map(block => {
                            if (block.b_type === 'paragraph') {
                              return (
                                <div key={block.id} className="text-sm text-zinc-300 py-1.5 px-1 break-words whitespace-pre-wrap leading-relaxed">
                                  {block.task_text}
                                </div>
                              );
                            }
                            return (
                              <div 
                                key={block.id} 
                                className="flex items-center gap-3 group/block cursor-pointer hover:bg-zinc-800/50 p-2 rounded-md transition-colors"
                                onClick={(e) => toggleTaskBlock(note.id, block.id, block.checked, e)}
                              >
                                <div className={`w-4 h-4 border rounded-sm flex items-center justify-center transition-colors flex-shrink-0 ${block.checked ? 'bg-accent-green/20 border-accent-green/50 text-accent-green' : 'border-zinc-500 text-transparent group-hover/block:border-zinc-400'}`}>
                                  <Check size={12} />
                                </div>
                                <span className={`text-sm transition-colors ${block.checked ? 'text-zinc-600 line-through' : 'text-zinc-200 group-hover/block:text-white'}`}>
                                  {block.task_text || 'Untitled Task'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[10px] text-zinc-600 italic">No tasks found in this document.</div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
