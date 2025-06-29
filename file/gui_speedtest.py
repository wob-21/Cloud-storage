import subprocess, threading, time, requests
import tkinter as tk
from tkinter import messagebox

MIRRORS = {
    "默认（PyPI）": "https://pypi.org/simple",
    "清华大学": "https://pypi.tuna.tsinghua.edu.cn/simple",
    "阿里云": "https://mirrors.aliyun.com/pypi/simple/",
    "豆瓣": "https://pypi.douban.com/simple/",
    "中科大": "https://pypi.mirrors.ustc.edu.cn/simple/",
    "华为云": "https://repo.huaweicloud.com/repository/pypi/simple/",
    "PyPI Fastly（美国）": "https://pypi.python.org/simple",
    "Cloudflare CDN": "https://files.pythonhosted.org/simple/"
}

def set_mirror(name, url):
    try:
        subprocess.run(["pip", "config", "set", "global.index-url", url], check=True)
        messagebox.showinfo("成功", f"✅ 已切换为：{name}\n{url}")
    except subprocess.CalledProcessError:
        messagebox.showerror("失败", "⚠️ 设置失败，请尝试以管理员身份运行")

def get_current_mirror():
    try:
        result = subprocess.run(["pip", "config", "get", "global.index-url"], capture_output=True, text=True)
        return result.stdout.strip()
    except:
        return "未知"

def test_speed(url, label_widget):
    try:
        start = time.time()
        requests.get(url, timeout=3)
        elapsed = round((time.time() - start) * 1000)
        label_widget.config(text=f"{url}\n响应时间: {elapsed} ms", fg="green" if elapsed < 300 else "orange")
    except:
        label_widget.config(text=f"{url}\n连接失败", fg="red")

def run_speed_tests():
    for name, (label, url) in label_refs.items():
        label.config(text="测速中...", fg="gray")
        threading.Thread(target=test_speed, args=(url, label)).start()

root = tk.Tk()
root.title("PIP 镜像切换器 & 测速推荐")

tk.Label(root, text="请选择镜像源并切换：", font=("微软雅黑", 12)).pack(pady=10)

label_refs = {}
for name, url in MIRRORS.items():
    frame = tk.Frame(root)
    frame.pack(pady=2, fill=tk.X)
    btn = tk.Button(frame, text=name, width=24, command=lambda n=name, u=url: set_mirror(n, u))
    btn.pack(side=tk.LEFT, padx=5)
    lbl = tk.Label(frame, text=url, font=("Courier New", 9), fg="gray")
    lbl.pack(side=tk.LEFT, fill=tk.X, expand=True)
    label_refs[name] = (lbl, url)

tk.Button(root, text="测速推荐", command=run_speed_tests, bg="#ccc").pack(pady=10)

tk.Label(root, text="当前镜像源：", font=("微软雅黑", 10)).pack()
tk.Label(root, text=get_current_mirror(), fg="blue").pack()

root.mainloop()
