import os
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, scrolledtext
from yt_dlp import YoutubeDL

# --- 核心基础配置 ---
PROXY_ADDR = "http://127.0.0.1:2080"
DESKTOP = Path(os.path.join(os.path.expanduser("~"), "Desktop"))

# --- 自定义日志过滤器：只看进度，不看警告 ---
class MyLogger:
    def __init__(self, app):
        self.app = app
    def debug(self, msg):
        # 仅显示包含下载百分比或提取信息的日志
        if "extracting" in msg.lower() or "download" in msg.lower():
            if "%" in msg: # 过滤进度条
                self.app.log_print_status(f"[下载进度] {msg}")
            else:
                self.app.log_print(f"[系统] {msg}")
    def warning(self, msg):
        # 彻底拦截 JavaScript runtime 警告，不显示在界面上
        if "JavaScript runtime" not in msg:
            pass 
    def error(self, msg):
        self.app.log_print(f"[错误] {msg}")

class YTGuiApp:
    def __init__(self, root):
        self.root = root
        root.title("YouTube 下载器 (专业静默版)")

        # 界面布局
        tk.Label(root, text="频道视频页 URL:").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.url_var = tk.StringVar(value="https://www.youtube.com/@EDMForYouMusic/videos")
        tk.Entry(root, textvariable=self.url_var, width=60).grid(row=0, column=1, columnspan=2, padx=5, pady=5)

        tk.Label(root, text="输出保存目录:").grid(row=1, column=0, padx=5, pady=5, sticky="w")
        self.outdir_var = tk.StringVar(value=str(DESKTOP / "EDM_For_You_Audio"))
        tk.Entry(root, textvariable=self.outdir_var, width=50).grid(row=1, column=1, padx=5, pady=5)
        tk.Button(root, text="选择...", command=self.choose_dir).grid(row=1, column=2, padx=5, pady=5)

        # 增加状态显示行
        self.status_label = tk.Label(root, text="就绪", fg="blue")
        self.status_label.grid(row=3, column=0, columnspan=3, sticky="w", padx=10)

        self.log = scrolledtext.ScrolledText(root, width=85, height=25, font=("Consolas", 9))
        self.log.grid(row=2, column=0, columnspan=3, padx=10, pady=5)

        self.start_btn = tk.Button(root, text="开始同步下载", command=self.start_download, bg="#4CAF50", fg="white", width=25)
        self.start_btn.grid(row=4, column=1, pady=10)

    def log_print(self, text):
        self.log.insert(tk.END, text + "\n")
        self.log.see(tk.END)
        self.root.update_idletasks()

    def log_print_status(self, text):
        # 进度条显示在状态栏，不刷屏日志区
        self.status_label.config(text=text)
        self.root.update_idletasks()

    def choose_dir(self):
        d = filedialog.askdirectory(initialdir=self.outdir_var.get())
        if d: self.outdir_var.set(d)

    def start_download(self):
        self.start_btn.config(state=tk.DISABLED)
        self.log.delete(1.0, tk.END) # 清空旧日志
        threading.Thread(target=self.download_task, daemon=True).start()

    def download_task(self):
        channel_url = self.url_var.get().strip()
        outdir = Path(self.outdir_var.get())
        outdir.mkdir(parents=True, exist_ok=True)
        
        history_file = outdir / "downloaded_ids.txt"
        history_ids = set()
        if history_file.exists():
            with open(history_file, "r", encoding="utf-8") as f:
                history_ids = set(line.strip() for line in f if line.strip())

        self.log_print("[*] 正在扫描频道最新视频，请稍候...")

        # 扫描选项
        ydl_opts_base = {
            'proxy': PROXY_ADDR,
            'logger': MyLogger(self),
            'no_warnings': True,     # 强制不输出警告
            'nocheckcertificate': True,
        }

        try:
            with YoutubeDL(ydl_opts_base) as ydl:
                info = ydl.extract_info(channel_url, download=False)
        except Exception as e:
            self.log_print(f"[停止] 扫描失败，请检查代理是否正常: {e}")
            self.start_btn.config(state=tk.NORMAL)
            return

        entries = info.get("entries", [])
        new_items = [e for e in entries if e and e.get("id") not in history_ids]

        if not new_items:
            self.log_print("[!] 扫描完成，没有发现新视频。")
            self.start_btn.config(state=tk.NORMAL)
            return

        self.log_print(f"[*] 发现 {len(new_items)} 个新任务，开始顺序下载...")

        for item in new_items:
            vid = item.get("id")
            title = item.get("title")
            raw_date = item.get("upload_date") or "00000000"
            date_folder = f"{raw_date[0:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
            
            save_path = outdir / date_folder
            save_path.mkdir(parents=True, exist_ok=True)
            
            self.log_print(f"\n[处理中] {title}")

            ydl_opts_download = {
                'proxy': PROXY_ADDR,
                'logger': MyLogger(self),
                'no_warnings': True, # 屏蔽警告
                'format': 'bestaudio[abr<=128]/bestaudio/best',
                'outtmpl': str(save_path / "%(title)s.%(ext)s"),
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '128',
                }],
            }

            try:
                with YoutubeDL(ydl_opts_download) as ydl:
                    ydl.download([f"https://www.youtube.com/watch?v={vid}"])
                
                # 记录已下载的 ID
                with open(history_file, "a", encoding="utf-8") as f:
                    f.write(vid + "\n")
                self.log_print(f"[成功] 文件已存为 MP3")
            except Exception as e:
                self.log_print(f"[跳过] 该视频下载失败: {e}")

        self.log_print("\n[完成] 所有下载任务已处理完毕！")
        self.status_label.config(text="任务全部完成", fg="green")
        self.start_btn.config(state=tk.NORMAL)

if __name__ == "__main__":
    root = tk.Tk()
    app = YTGuiApp(root)
    root.mainloop()