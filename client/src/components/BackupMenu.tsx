/**
 * BackupMenu — header control for saving footprint data to a JSON file on disk.
 * States: no file chosen / needs one-click reconnect / auto-saving.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { FootprintData, parseFootprintData } from "@/lib/footprintData";
import {
  createBackupFile,
  downloadBackup,
  forgetBackupFile,
  fsSupported,
  getSavedHandle,
  hasPermission,
  openBackupFile,
  readHandle,
  requestPermission,
  writeHandle,
} from "@/lib/fileBackup";

type Status = "none" | "reconnect" | "connected";

interface Props {
  data: FootprintData;
  replaceAll: (d: FootprintData) => void;
}

const isAbort = (e: unknown) => (e as any)?.name === "AbortError";

export default function BackupMenu({ data, replaceAll }: Props) {
  const [status, setStatus] = useState<Status>("none");
  const [open, setOpen] = useState(false);
  const handleRef = useRef<any>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const loadedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // On mount: find a remembered file; reconnect silently if permission persists.
  useEffect(() => {
    (async () => {
      const h = await getSavedHandle();
      if (!h) return;
      handleRef.current = h;
      try {
        if (await hasPermission(h)) {
          const fileData = await readHandle(h);
          if (fileData) replaceAll(fileData);
          loadedRef.current = true;
          setStatus("connected");
        } else {
          setStatus("reconnect");
        }
      } catch {
        setStatus("reconnect");
      }
    })();
  }, [replaceAll]);

  // Auto-save to the file whenever data changes (debounced).
  useEffect(() => {
    if (status !== "connected" || !handleRef.current || !loadedRef.current) return;
    const t = setTimeout(() => {
      writeHandle(handleRef.current, data).catch(() => {
        setStatus("reconnect");
        toast.error("存档文件写入失败，请点击存档按钮重新连接");
      });
    }, 300);
    return () => clearTimeout(t);
  }, [data, status]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const reconnect = useCallback(async () => {
    try {
      const h = handleRef.current;
      if (!h || !(await requestPermission(h))) return;
      const fileData = await readHandle(h);
      if (fileData) replaceAll(fileData);
      loadedRef.current = true;
      setStatus("connected");
      setOpen(false);
      toast.success("已从存档文件恢复，之后自动保存");
    } catch {
      toast.error("无法读取存档文件，可能已被移动或删除");
    }
  }, [replaceAll]);

  const create = useCallback(async () => {
    try {
      handleRef.current = await createBackupFile(dataRef.current);
      loadedRef.current = true;
      setStatus("connected");
      setOpen(false);
      toast.success("已创建存档文件，之后自动保存");
    } catch (e) {
      if (!isAbort(e)) toast.error("创建存档失败");
    }
  }, []);

  const openExisting = useCallback(async () => {
    try {
      const { handle, data: fileData } = await openBackupFile();
      handleRef.current = handle;
      replaceAll(fileData);
      loadedRef.current = true;
      setStatus("connected");
      setOpen(false);
      toast.success("已载入存档，之后自动保存");
    } catch (e) {
      if (!isAbort(e)) toast.error("不是有效的存档文件");
    }
  }, [replaceAll]);

  const disconnect = useCallback(async () => {
    await forgetBackupFile();
    handleRef.current = null;
    loadedRef.current = false;
    setStatus("none");
    setOpen(false);
  }, []);

  const importFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      const parsed = parseFootprintData(await f.text());
      if (!parsed) return void toast.error("不是有效的存档文件");
      replaceAll(parsed);
      setOpen(false);
      toast.success("已导入");
    },
    [replaceAll]
  );

  const dot =
    status === "connected" ? "#10b981" : status === "reconnect" ? "#f59e0b" : "#cbd5e1";
  const item =
    "w-full text-left px-3 py-2 text-xs hover:bg-gray-50 rounded-md text-gray-700";

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => (status === "reconnect" ? reconnect() : setOpen((v) => !v))}
        className="relative p-2 rounded-lg transition-all duration-200 text-gray-400 hover:text-sky-700 hover:bg-sky-50"
        style={{ border: "1px solid #e5e7eb" }}
        title={
          status === "connected"
            ? "已自动保存到存档文件"
            : status === "reconnect"
              ? "点击继续上次的存档"
              : "保存 / 导入存档"
        }
      >
        <Save size={14} />
        <span
          className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
          style={{ background: dot }}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-56 p-1 rounded-xl bg-white z-50"
          style={{ border: "1px solid #e5e7eb", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
        >
          {fsSupported && status === "none" && (
            <>
              <button className={item} onClick={create}>新建存档文件…</button>
              <button className={item} onClick={openExisting}>打开已有存档…</button>
            </>
          )}
          {fsSupported && status === "connected" && (
            <>
              <div className="px-3 py-2 text-[11px] text-emerald-600">● 正在自动保存到文件</div>
              <button className={item} onClick={openExisting}>换一个存档文件…</button>
              <button className={item} onClick={disconnect}>断开存档文件</button>
            </>
          )}
          <button className={item} onClick={() => downloadBackup(data)}>导出 JSON</button>
          <button className={item} onClick={() => importRef.current?.click()}>导入 JSON</button>
          {!fsSupported && (
            <div className="px-3 py-2 text-[11px] text-gray-400">
              自动存档需要 Chrome / Edge
            </div>
          )}
        </div>
      )}
      <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={importFile} />
    </div>
  );
}
