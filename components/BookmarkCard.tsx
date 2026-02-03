import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Trash2, Globe, Edit2, Copy, Check, Share2, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bookmark } from '../types';
import { getFaviconUrl } from '../utils/helpers';

interface BookmarkCardProps {
  bookmark: Bookmark;
  onDelete: (id: string) => void;
  onEdit: (bookmark: Bookmark) => void;
  isDragOverlay?: boolean;
}

const BookmarkCard: React.FC<BookmarkCardProps> = ({ bookmark, onDelete, onEdit, isDragOverlay = false }) => {
  const [imageError, setImageError] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // dnd-kit hook
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bookmark.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
    touchAction: 'none', // Prevents scrolling when dragging via the handle
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(bookmark.url).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    copyToClipboard();
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (navigator.share) {
      try {
        await navigator.share({
          title: bookmark.title,
          text: `Check out this link: ${bookmark.title}`,
          url: bookmark.url,
        });
      } catch (err) {
        console.log('Share canceled or failed:', err);
      }
    } else {
      copyToClipboard();
    }
  };

  const handleVisit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(bookmark.url, '_blank', 'noopener,noreferrer');
  };

  // If this is the "Ghost" overlay, we don't want the hook attributes/listeners on it again
  const cardProps = isDragOverlay ? {} : {
    ref: setNodeRef,
    style: style,
    ...attributes
  };

  return (
    <motion.div
      layout={!isDragging} // Disable layout animation while dragging to prevent fighting with DnD
      initial={isDragOverlay ? undefined : { opacity: 0, y: 20 }}
      animate={isDragOverlay ? undefined : { opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={isDragOverlay ? undefined : { y: -5, scale: 1.02 }}
      className={`group relative w-full ${isDragOverlay ? 'cursor-grabbing scale-105 z-50' : ''}`}
      {...cardProps}
    >
      {/* Liquid Glass Card */}
      <div className={`
        relative overflow-hidden rounded-2xl
        bg-white/40 dark:bg-gray-900/40
        ${!isDragOverlay && 'hover:bg-white/60 dark:hover:bg-gray-900/60'}
        backdrop-blur-xl
        border border-white/40 dark:border-white/10
        shadow-lg dark:shadow-black/50
        transition-all duration-300
        h-full flex flex-col
        ${isDragOverlay ? 'shadow-2xl ring-2 ring-indigo-500/50 bg-white/80 dark:bg-gray-800/80' : ''}
      `}>
        {/* Glow Effect on Hover */}
        {!isDragOverlay && (
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        )}
        
        <div className="p-4 flex flex-col h-full z-10">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {/* Drag Handle */}
              {!isDragOverlay && (
                 <div 
                  {...listeners} 
                  className="cursor-grab active:cursor-grabbing p-1.5 -ml-2 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  title="Drag to reorder"
                >
                  <GripVertical size={18} />
                </div>
              )}
              
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/50 dark:bg-black/50 backdrop-blur-md shadow-inner border border-white/20">
                {!imageError ? (
                  <img 
                    src={getFaviconUrl(bookmark.domain)} 
                    alt={bookmark.title}
                    className="w-6 h-6 object-contain"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <Globe className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-1">
              <motion.button
                whileHover={{ scale: 1.1, color: '#3b82f6' }}
                whileTap={{ scale: 0.9 }}
                onClick={handleShare}
                className="p-2 rounded-full hover:bg-blue-500/10 text-gray-400 dark:text-gray-500 transition-colors"
                title="Share"
              >
                <Share2 size={16} />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1, color: '#10b981' }}
                whileTap={{ scale: 0.9 }}
                onClick={handleCopy}
                className="p-2 rounded-full hover:bg-emerald-500/10 text-gray-400 dark:text-gray-500 transition-colors"
                title={isCopied ? "Copied!" : "Copy Link"}
              >
                {isCopied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1, color: '#6366f1' }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit(bookmark);
                }}
                className="p-2 rounded-full hover:bg-indigo-500/10 text-gray-400 dark:text-gray-500 transition-colors"
                title="Edit Bookmark"
              >
                <Edit2 size={16} />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.1, color: '#ef4444' }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(bookmark.id);
                }}
                className="p-2 rounded-full hover:bg-red-500/10 text-gray-400 dark:text-gray-500 transition-colors"
                title="Delete Bookmark"
              >
                <Trash2 size={16} />
              </motion.button>
            </div>
          </div>

          <div className="flex-grow">
            <h3 className="text-base font-bold text-gray-800 dark:text-white mb-0.5 line-clamp-1 leading-tight">
              {bookmark.title || bookmark.domain}
            </h3>
            <p className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 mb-1 uppercase tracking-wide">
              {bookmark.category}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {bookmark.domain}
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200/30 dark:border-white/5 flex justify-end">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleVisit}
              className="
                flex items-center space-x-1.5 px-3 py-1.5 rounded-lg
                bg-indigo-600/10 dark:bg-indigo-500/20 
                hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500
                text-indigo-700 dark:text-indigo-300
                font-medium text-xs transition-all duration-300
              "
            >
              <span>Visit</span>
              <ExternalLink size={12} />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default BookmarkCard;