import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Moon, Sun, BookMarked, LayoutGrid, ArrowUpDown, ChevronDown, Settings, Download, Upload, Trash2, X, AlertTriangle, WifiOff, Smartphone } from 'lucide-react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  DragEndEvent,
  DragStartEvent,
  TouchSensor
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  rectSortingStrategy 
} from '@dnd-kit/sortable';

import { Bookmark, CategoryType, Theme } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import CategoryTabs from './components/CategoryTabs';
import BookmarkCard from './components/BookmarkCard';
import AddBookmarkForm from './components/AddBookmarkForm';

const CATEGORIES: CategoryType[] = [
  'All Bookmarks',
  'YouTube',
  'Websites',
  'Developer',
  'Social',
  'Learning',
  'Shopping'
];

type SortOption = 'newest' | 'oldest' | 'a-z' | 'z-a' | 'domain' | 'custom';

// Interface for the BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function App() {
  const [theme, setTheme] = useLocalStorage<Theme>('bookmarker-theme', 'dark');
  const [bookmarks, setBookmarks] = useLocalStorage<Bookmark[]>('bookmarker-data', []);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('All Bookmarks');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  
  // DnD State
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Delete confirmation state
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  
  // PWA & Connectivity State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Prevent drag on simple clicks
      },
    }),
    useSensor(TouchSensor, {
        // Press delay for touch to avoid conflict with scroll, 
        // though we use a handle, this adds safety.
        activationConstraint: {
            delay: 150,
            tolerance: 5,
        }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Splash Screen Logic
  useEffect(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      setTimeout(() => {
        splash.style.opacity = '0';
        setTimeout(() => {
          splash.remove();
        }, 500);
      }, 2000);
    }
  }, []);

  // Connectivity Listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // PWA Install Prompt Listener
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  // Apply theme to body
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#000000';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#f3f4f6';
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const openAddModal = () => {
    setEditingBookmark(null);
    setIsModalOpen(true);
  };

  const openEditModal = (bookmark: Bookmark) => {
    setEditingBookmark(bookmark);
    setIsModalOpen(true);
  };

  const handleSaveBookmark = (bookmarkData: Omit<Bookmark, 'id' | 'createdAt'>) => {
    if (editingBookmark) {
      // Update existing
      setBookmarks(prev => prev.map(b => 
        b.id === editingBookmark.id 
          ? { ...b, ...bookmarkData } 
          : b
      ));
    } else {
      // Add new
      const newBookmark: Bookmark = {
        ...bookmarkData,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      };
      setBookmarks(prev => [newBookmark, ...prev]);
    }
    setIsModalOpen(false);
    setEditingBookmark(null);
  };

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      setBookmarks(prev => prev.filter(b => b.id !== itemToDelete));
      setItemToDelete(null);
    }
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(bookmarks, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `bookmarker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files[0]) {
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = e => {
        if (e.target?.result) {
          try {
            const parsed = JSON.parse(e.target.result as string);
            if (Array.isArray(parsed)) {
              const isValid = parsed.every(b => b.id && b.url && typeof b.createdAt === 'number');
              if (isValid) {
                if (confirm(`Found ${parsed.length} bookmarks. This will merge them with your current ${bookmarks.length} bookmarks. Continue?`)) {
                   const currentIds = new Set(bookmarks.map(b => b.id));
                   const newBookmarks = parsed.filter(b => !currentIds.has(b.id));
                   const updatedBookmarks = [...bookmarks, ...newBookmarks];
                   setBookmarks(updatedBookmarks);
                   alert(`Successfully imported ${newBookmarks.length} new bookmarks.`);
                   setIsSettingsOpen(false);
                }
              } else {
                alert("Invalid file format. Please upload a valid Bookmarker JSON backup.");
              }
            } else {
              alert("Invalid JSON format. Expected an array of bookmarks.");
            }
          } catch (err) {
            console.error(err);
            alert("Error parsing JSON file.");
          }
        }
      };
    }
    if (event.target) event.target.value = '';
  };

  const handleClearAll = () => {
    if (confirm("WARNING: This will permanently delete ALL your bookmarks. This action cannot be undone. Are you absolutely sure?")) {
      setBookmarks([]);
      setIsSettingsOpen(false);
    }
  };

  // --- Filtering & Sorting Logic ---
  
  const filteredBookmarks = bookmarks
    .filter(bookmark => {
      const matchesCategory = selectedCategory === 'All Bookmarks' || bookmark.category === selectedCategory;
      const matchesSearch = 
        bookmark.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bookmark.domain.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      switch (sortOption) {
        case 'newest': return b.createdAt - a.createdAt;
        case 'oldest': return a.createdAt - b.createdAt;
        case 'a-z': return a.title.localeCompare(b.title);
        case 'z-a': return b.title.localeCompare(a.title);
        case 'domain': return a.domain.localeCompare(b.domain);
        case 'custom': return 0; // Respect array order
        default: return 0;
      }
    });

  // --- Drag and Drop Logic ---

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    // Automatically switch to custom sort if user rearranges
    if (sortOption !== 'custom') {
      setSortOption('custom');
    }

    setBookmarks((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      
      // We use the global index to reorder the main state
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const activeBookmark = activeId ? bookmarks.find(b => b.id === activeId) : null;

  return (
    <div className={`min-h-screen text-gray-800 dark:text-gray-100 overflow-x-hidden selection:bg-indigo-500 selection:text-white`}>
      
      {/* Offline Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-500/90 backdrop-blur-sm text-white text-xs font-bold text-center overflow-hidden z-50 fixed top-0 w-full"
          >
            <div className="py-1 flex items-center justify-center gap-2">
              <WifiOff size={14} />
              <span>You are offline. App is running in local mode.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Liquid Background Blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/20 blur-[120px] animate-pulse" />
        <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-indigo-500/20 blur-[100px] animate-pulse delay-700" />
        <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] rounded-full bg-blue-500/20 blur-[120px] animate-pulse delay-1000" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 relative mt-2">
        
        {/* Header */}
        <header className="flex flex-col gap-3 sm:gap-6 mb-4 sm:mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/30">
                <BookMarked className="text-white w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                Bookmarker
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="hidden md:flex p-3 rounded-2xl bg-white/50 dark:bg-white/5 backdrop-blur-md border border-gray-200/50 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/10 transition-all shadow-sm items-center justify-center"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}
              </button>

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-3 rounded-2xl bg-white/50 dark:bg-white/5 backdrop-blur-md border border-gray-200/50 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/10 transition-all shadow-sm"
              >
                <Settings className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:items-center gap-2 sm:gap-3 w-full justify-between">
             <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto flex-1">
                <div className="relative group min-w-[130px] sm:min-w-[160px]">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ArrowUpDown className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                    className="
                      block w-full pl-9 pr-8 py-3 appearance-none
                      bg-white/50 dark:bg-white/5 
                      backdrop-blur-md 
                      border border-gray-200/50 dark:border-white/10 
                      rounded-2xl 
                      focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 
                      text-base sm:text-sm font-medium transition-all shadow-sm
                      text-gray-700 dark:text-gray-200
                      cursor-pointer outline-none
                      truncate
                    "
                  >
                    <option value="custom" className="bg-white dark:bg-gray-900">Custom Order</option>
                    <option value="newest" className="bg-white dark:bg-gray-900">Newest</option>
                    <option value="oldest" className="bg-white dark:bg-gray-900">Oldest</option>
                    <option value="a-z" className="bg-white dark:bg-gray-900">A-Z</option>
                    <option value="z-a" className="bg-white dark:bg-gray-900">Z-A</option>
                    <option value="domain" className="bg-white dark:bg-gray-900">Domain</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </div>
                </div>

                <div className="relative flex-grow group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="
                      block w-full pl-10 pr-3 py-3 
                      bg-white/50 dark:bg-white/5 
                      backdrop-blur-md 
                      border border-gray-200/50 dark:border-white/10 
                      rounded-2xl 
                      focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 
                      placeholder-gray-500 dark:placeholder-gray-400 
                      text-base sm:text-sm transition-all shadow-sm
                      dark:text-white
                    "
                  />
                </div>
             </div>
          </div>
        </header>

        <div className="sticky top-4 z-30 mb-4 sm:mb-8 space-y-4">
          <div className="flex items-center justify-between backdrop-blur-xl bg-white/30 dark:bg-black/30 p-2 rounded-[20px] border border-white/20 dark:border-white/5 shadow-lg">
            <div className="flex-grow overflow-hidden">
               <CategoryTabs 
                 categories={CATEGORIES} 
                 selectedCategory={selectedCategory} 
                 onSelectCategory={setSelectedCategory} 
               />
            </div>
            <div className="pl-2 border-l border-gray-200/50 dark:border-white/10 hidden md:block">
               <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={openAddModal}
                className="
                  flex items-center space-x-2 px-6 py-2.5 rounded-2xl
                  bg-indigo-600 text-white font-medium
                  shadow-lg shadow-indigo-500/30
                  hover:bg-indigo-700 transition-colors
                "
              >
                <Plus size={18} />
                <span>Add New</span>
              </motion.button>
            </div>
          </div>
        </div>

        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={openAddModal}
          className="md:hidden fixed bottom-6 right-6 z-40 p-4 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-600/40"
        >
          <Plus size={24} />
        </motion.button>

        {/* Bookmarks Grid with DnD */}
        <div className="min-h-[50vh] pb-24 sm:pb-8">
          {bookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-20 h-20 bg-indigo-100/10 rounded-full flex items-center justify-center mb-4">
                <LayoutGrid className="w-10 h-10 text-indigo-400 opacity-50" />
              </div>
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No bookmarks yet</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                Start building your collection by adding your first bookmark.
              </p>
              <button 
                onClick={openAddModal}
                className="mt-6 text-indigo-500 hover:text-indigo-400 font-medium"
              >
                + Add your first bookmark
              </button>
            </div>
          ) : filteredBookmarks.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-center">
              <Search className="w-12 h-12 text-gray-400 mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">No matches found</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Try adjusting your search or category filter.
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={filteredBookmarks.map(b => b.id)}
                strategy={rectSortingStrategy}
              >
                <motion.div 
                  layout={!activeId} // Disable framer-motion layout during drag to prevent conflict
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
                >
                  <AnimatePresence>
                    {filteredBookmarks.map((bookmark) => (
                      <BookmarkCard 
                        key={bookmark.id} 
                        bookmark={bookmark} 
                        onDelete={handleDeleteClick} 
                        onEdit={openEditModal}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              </SortableContext>

              {/* Drag Overlay for smooth visuals */}
              <DragOverlay adjustScale={true}>
                {activeBookmark ? (
                  <div className="opacity-90">
                     <BookmarkCard
                        bookmark={activeBookmark}
                        onDelete={() => {}}
                        onEdit={() => {}}
                        isDragOverlay
                      />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </div>

      <AddBookmarkForm 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingBookmark(null);
        }} 
        onSubmit={handleSaveBookmark}
        initialData={editingBookmark}
        categories={CATEGORIES}
      />

      <AnimatePresence>
        {itemToDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setItemToDelete(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-sm bg-white/90 dark:bg-gray-900/95 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl rounded-[2rem] p-6 text-center">
                <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Bookmark?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Are you sure you want to delete this bookmark? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setItemToDelete(null)}
                    className="flex-1 py-3 px-4 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 py-3 px-4 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 shadow-lg shadow-red-500/30 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-sm">
                <div className="relative overflow-hidden rounded-[2rem] bg-white/90 dark:bg-gray-900/95 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl p-6">
                  
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Settings className="w-5 h-5 text-indigo-500" />
                      Settings
                    </h2>
                    <button onClick={() => setIsSettingsOpen(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Install App Button */}
                    {installPrompt && (
                      <button
                        onClick={handleInstallClick}
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 hover:from-indigo-500/20 hover:to-purple-500/20 transition-all group mb-4"
                      >
                         <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
                          <Smartphone size={18} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-gray-900 dark:text-white">Install App</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Add to Home Screen</p>
                        </div>
                      </button>
                    )}

                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                      <span className="font-medium text-gray-700 dark:text-gray-200">Appearance</span>
                      <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg bg-white dark:bg-black/20 shadow-sm border border-gray-200 dark:border-white/10"
                      >
                        {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
                      </button>
                    </div>

                    <div className="h-px bg-gray-200 dark:bg-white/10 my-2" />

                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Data Management</p>
                      
                      <button
                        onClick={handleExportData}
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-gray-50/50 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-gray-100 dark:border-white/5 transition-colors group"
                      >
                        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800 transition-colors">
                          <Download size={18} />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-gray-900 dark:text-white">Export Bookmarks</p>
                          <p className="text-xs text-gray-500">Download backup JSON file</p>
                        </div>
                      </button>

                      <button
                        onClick={handleImportClick}
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-gray-50/50 dark:bg-white/5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-gray-100 dark:border-white/5 transition-colors group"
                      >
                         <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800 transition-colors">
                          <Upload size={18} />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-gray-900 dark:text-white">Import Bookmarks</p>
                          <p className="text-xs text-gray-500">Restore from backup file</p>
                        </div>
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          onChange={handleImportFile}
                          className="hidden"
                          accept="application/json"
                        />
                      </button>

                      <button
                        onClick={handleClearAll}
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 border border-red-100 dark:border-red-900/20 transition-colors group mt-4"
                      >
                        <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 group-hover:bg-red-200 dark:group-hover:bg-red-800 transition-colors">
                          <AlertTriangle size={18} />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-red-700 dark:text-red-400">Clear All Data</p>
                          <p className="text-xs text-red-500/80">Permanently delete everything</p>
                        </div>
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;