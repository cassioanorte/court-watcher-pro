import { useState, useRef, useCallback } from "react";
import { Upload, Loader2, X, FileText } from "lucide-react";
import { toast } from "sonner";

interface FileDropZoneProps {
  onFile: (file: File) => void;
  accept?: string;
  loading?: boolean;
  loadingText?: string;
  label?: string;
  sublabel?: string;
  fileName?: string;
  onClear?: () => void;
  multiple?: boolean;
  onFiles?: (files: File[]) => void;
  className?: string;
  compact?: boolean;
  children?: React.ReactNode;
}

export const FileDropZone = ({
  onFile,
  accept = "*",
  loading = false,
  loadingText = "Enviando...",
  label = "Arraste o arquivo aqui ou clique para selecionar",
  sublabel,
  fileName,
  onClear,
  multiple = false,
  onFiles,
  className = "",
  compact = false,
  children,
}: FileDropZoneProps) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptExts = accept
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);

  const isAccepted = useCallback(
    (file: File) => {
      if (accept === "*") return true;
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      const mime = file.type.toLowerCase();
      return acceptExts.some(
        (a) =>
          a === ext ||
          a === mime ||
          (a.endsWith("/*") && mime.startsWith(a.replace("/*", "/"))) ||
          (a === "image/*" && mime.startsWith("image/"))
      );
    },
    [accept, acceptExts]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (loading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const validFiles = files.filter(isAccepted);
    if (validFiles.length === 0) {
      toast.error("Tipo de arquivo não aceito");
      return;
    }

    if (multiple && onFiles) {
      onFiles(validFiles);
    } else {
      onFile(validFiles[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (multiple && onFiles) {
      onFiles(files);
    } else if (files[0]) {
      onFile(files[0]);
    }
    e.target.value = "";
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
        dragging
          ? "border-accent bg-accent/5"
          : "hover:border-accent/50"
      } ${compact ? "p-3" : "p-6"} text-center ${className}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        disabled={loading}
      />

      {fileName && onClear ? (
        <div className="flex items-center gap-2 justify-center">
          <FileText className="w-5 h-5 text-accent" />
          <span className="text-sm text-foreground">{fileName}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : children ? (
        children
      ) : (
        <>
          {loading ? (
            <Loader2 className={`${compact ? "w-5 h-5" : "w-8 h-8"} text-muted-foreground/40 mx-auto mb-2 animate-spin`} />
          ) : (
            <Upload className={`${compact ? "w-5 h-5" : "w-8 h-8"} text-muted-foreground/40 mx-auto mb-2`} />
          )}
          <p className="text-sm text-muted-foreground">
            {loading ? loadingText : label}
          </p>
          {sublabel && !loading && (
            <p className="text-xs text-muted-foreground/60 mt-1">{sublabel}</p>
          )}
        </>
      )}
    </div>
  );
};
