"use client";

import { useCallback, useRef, useState } from "react";

interface PhotoUploadProps {
  onUploaded: (imageUrl: string) => void;
  onError?: (msg: string) => void;
}

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.8;

type Status = "idle" | "processing" | "uploading" | "done" | "error";

export function PhotoUpload({ onUploaded, onError }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const lastFileRef = useRef<File | null>(null);

  const reportError = useCallback(
    (msg: string) => {
      setErrorMsg(msg);
      setStatus("error");
      onError?.(msg);
    },
    [onError]
  );

  const processFile = useCallback(
    async (file: File): Promise<Blob | null> => {
      let bitmap: ImageBitmap | null = null;
      try {
        bitmap = await createImageBitmap(file, {
          imageOrientation: "from-image",
        });
      } catch {
        reportError("无法读取图片，请换一张试试");
        return null;
      }

      let width = bitmap.width;
      let height = bitmap.height;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width >= height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reportError("画布初始化失败");
        return null;
      }
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();

      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob(
          (blob) => resolve(blob),
          "image/jpeg",
          JPEG_QUALITY
        );
      });
    },
    [reportError]
  );

  const uploadBlob = useCallback(
    async (blob: Blob, ext: string) => {
      const formData = new FormData();
      const filename = `photo.${ext}`;
      formData.append("image", blob, filename);

      return new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/mistakes/upload");
        xhr.upload.onprogress = (e: ProgressEvent) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          let payload: { imageUrl?: string; error?: string } | null = null;
          try {
            payload = JSON.parse(xhr.responseText || "null");
          } catch {
            payload = null;
          }
          if (xhr.status >= 200 && xhr.status < 300 && payload?.imageUrl) {
            resolve(payload.imageUrl);
          } else {
            reject(new Error(payload?.error || `上传失败 (${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error("网络错误，上传失败"));
        xhr.send(formData);
      });
    },
    []
  );

  const handleFile = useCallback(
    async (file: File) => {
      lastFileRef.current = file;
      setStatus("processing");
      setProgress(0);
      setErrorMsg("");

      if (!file.type.startsWith("image/")) {
        reportError("请选择图片文件");
        return;
      }

      const blob = await processFile(file);
      if (!blob) return;

      const previewUrl = URL.createObjectURL(blob);
      setPreviewUrl(previewUrl);

      setStatus("uploading");
      try {
        const imageUrl = await uploadBlob(blob, "jpg");
        setStatus("done");
        onUploaded(imageUrl);
      } catch (err) {
        reportError(err instanceof Error ? err.message : "上传失败");
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    },
    [onUploaded, processFile, reportError, uploadBlob]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  };

  const handleRetry = () => {
    const file = lastFileRef.current;
    if (file) void handleFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const busy = status === "processing" || status === "uploading";

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleInputChange}
        disabled={busy}
      />

      {previewUrl ? (
        <div className="max-w-xs">
          <img
            src={previewUrl}
            alt="预览"
            className="w-full rounded-lg border border-gray-200 object-contain"
          />
          {busy ? (
            <div className="mt-2">
              <div className="h-2 w-full overflow-hidden rounded bg-gray-200">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-center text-sm text-gray-600">
                {status === "processing" ? "处理中…" : `上传中 ${progress}%`}
              </p>
            </div>
          ) : null}
          {status === "done" ? (
            <p className="mt-2 text-center text-sm text-green-600">上传成功</p>
          ) : null}
          {status === "error" ? (
            <div className="mt-2 text-center">
              <p className="text-sm text-red-600">{errorMsg}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-1 rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
              >
                重试
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-6 text-center"
        >
          <p className="text-gray-600">
            {status === "error" ? errorMsg : "点击拍照或选择图片上传"}
          </p>
          {status === "error" ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRetry();
              }}
              className="mt-2 rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
            >
              重试
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
