'use client';

import {
  type DragEvent,
  type ChangeEvent,
  useCallback,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, FileVideo, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

interface SelectedFile {
  readonly file: File;
  readonly name: string;
  readonly size: string;
}

interface UploadZoneProps {
  readonly onFileSelect: (file: File) => void;
  readonly maxSizeMB?: number;
  readonly accept?: string;
  readonly progress?: number;
  readonly className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function UploadZone({
  onFileSelect,
  maxSizeMB = 500,
  accept = 'video/mp4,video/quicktime,video/x-msvideo,video/webm',
  progress,
  className,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);

      if (file.size > maxSizeBytes) {
        setError(`File exceeds ${maxSizeMB}MB limit (${formatFileSize(file.size)})`);
        return;
      }

      const validTypes = accept.split(',').map((t) => t.trim());
      const isValidType = validTypes.some((type) => {
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type);
        }
        return file.type === type || file.type.startsWith(type.replace('/*', '/'));
      });

      if (!isValidType && accept !== '*') {
        setError('Invalid file type. Please select a supported video format.');
        return;
      }

      const selected: SelectedFile = {
        file,
        name: file.name,
        size: formatFileSize(file.size),
      };

      setSelectedFile(selected);
      onFileSelect(file);
    },
    [accept, maxSizeBytes, maxSizeMB, onFileSelect],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        validateAndSelect(file);
      }
    },
    [validateAndSelect],
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        validateAndSelect(file);
      }
      /* Reset input so re-selecting the same file triggers onChange */
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [validateAndSelect],
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    setError(null);
  }, []);

  const isUploading = typeof progress === 'number' && progress >= 0 && progress < 100;
  const isComplete = typeof progress === 'number' && progress >= 100;

  return (
    <div className={clsx('w-full', className)}>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
        aria-label="Select video file"
      />

      <AnimatePresence mode="wait">
        {!selectedFile ? (
          /* Drop zone */
          <motion.div
            key="dropzone"
            className={clsx(
              'relative flex flex-col items-center justify-center',
              'rounded-[20px] p-8 sm:p-12',
              'border-2 border-dashed',
              'cursor-pointer transition-all duration-200',
              isDragOver
                ? 'border-[#0071E3] bg-[#0071E3]/[0.06] scale-[1.01]'
                : 'border-[#86868B]/60 bg-white hover:border-[#86868B] hover:bg-black/[0.02]',
            )}
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            role="button"
            tabIndex={0}
            aria-label="Drop video file here or click to browse"
          >
            {/* Upload icon */}
            <motion.div
              className={clsx(
                'flex items-center justify-center',
                'h-16 w-16 rounded-2xl mb-4',
                'bg-[#F5F5F7] border border-black/[0.06]',
                'transition-colors duration-200',
                isDragOver && 'bg-[#0071E3]/[0.12] border-[#0071E3]/30',
              )}
              animate={isDragOver ? { y: -4, scale: 1.05 } : { y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Upload
                size={28}
                className={clsx(
                  'transition-colors duration-200',
                  isDragOver ? 'text-[#0071E3]' : 'text-[#86868B]',
                )}
              />
            </motion.div>

            {/* Text */}
            <p className="text-sm font-medium text-[#1D1D1F] mb-1">
              {isDragOver ? 'Release to upload' : 'Drop video file here or click to browse'}
            </p>
            <p className="text-xs text-[#86868B]">
              MP4, MOV, AVI, WebM — up to {maxSizeMB}MB
            </p>

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.p
                  className="mt-3 text-xs text-[#EF4444] font-medium"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* Selected file display */
          <motion.div
            key="selected"
            className={clsx(
              'relative flex items-center gap-4',
              'rounded-[20px] p-4 sm:p-5',
              'bg-white',
              'border border-black/[0.06]',
            )}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {/* File icon */}
            <div
              className={clsx(
                'flex items-center justify-center shrink-0',
                'h-12 w-12 rounded-xl',
                isComplete
                  ? 'bg-[#22C55E]/[0.12] border border-[#22C55E]/25'
                  : 'bg-[#0071E3]/[0.12] border border-[#0071E3]/25',
              )}
            >
              {isComplete ? (
                <CheckCircle size={22} className="text-[#22C55E]" />
              ) : (
                <FileVideo size={22} className="text-[#0071E3]" />
              )}
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1D1D1F] truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-[#86868B] mt-0.5">
                {selectedFile.size}
                {isUploading && ` — ${Math.round(progress)}% uploaded`}
                {isComplete && ' — Upload complete'}
              </p>

              {/* Progress bar */}
              {isUploading && (
                <div className="mt-2 h-1.5 w-full rounded-full bg-black/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[#0071E3]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                  />
                </div>
              )}
            </div>

            {/* Remove button */}
            {!isUploading && (
              <button
                type="button"
                onClick={handleRemoveFile}
                className={clsx(
                  'flex items-center justify-center shrink-0',
                  'h-8 w-8 rounded-lg',
                  'bg-[#86868B]/30 text-[#86868B]',
                  'transition-colors hover:bg-[#EF4444]/[0.12] hover:text-[#EF4444]',
                )}
                aria-label="Remove file"
              >
                <X size={14} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
