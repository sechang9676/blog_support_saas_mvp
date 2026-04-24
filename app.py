from __future__ import annotations

import json
import os
import queue
import shutil
import subprocess
import threading
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext, ttk


APP_TITLE = "GIF 일괄 변환기"
DISPLAY_LIMIT_MB = 20
MAX_GIF_BYTES = DISPLAY_LIMIT_MB * 1024 * 1024
TARGET_GIF_BYTES = MAX_GIF_BYTES - 64 * 1024
MIN_WIDTH = 64
MIN_FPS = 1
COLOR_STEPS = [256, 192, 160, 128, 96, 64, 48, 32, 24, 16, 8]
VIDEO_FILETYPES = (
    "*.mp4",
    "*.mov",
    "*.avi",
    "*.mkv",
    "*.webm",
    "*.m4v",
    "*.wmv",
    "*.flv",
    "*.mpeg",
    "*.mpg",
)
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


def human_size(size_bytes: int) -> str:
    return f"{size_bytes / (1024 * 1024):.2f} MB"


def even_number(value: int) -> int:
    return max(2, value - (value % 2))


def next_lower_color_step(current: int) -> int:
    for value in COLOR_STEPS:
        if value < current:
            return value
    return current


def unique_output_path(input_path: Path, output_dir: Path, used_names: set[str]) -> Path:
    base_name = input_path.stem
    candidate = output_dir / f"{base_name}.gif"
    counter = 2

    while candidate.name.lower() in used_names or candidate.exists():
        candidate = output_dir / f"{base_name}_{counter}.gif"
        counter += 1

    used_names.add(candidate.name.lower())
    return candidate


class ConversionCancelled(Exception):
    pass


@dataclass
class VideoInfo:
    width: int
    height: int
    duration_seconds: float


@dataclass
class ConversionSettings:
    output_dir: Path
    fps: int
    width: int
    create_zip: bool
    target_bytes: int = TARGET_GIF_BYTES
    hard_limit_bytes: int = MAX_GIF_BYTES


@dataclass
class ConversionResult:
    input_path: Path
    output_path: Path | None
    success: bool
    message: str
    final_size_bytes: int = 0


class GifBatchConverter:
    def __init__(
        self,
        log_callback: Callable[[str], None],
        status_callback: Callable[[Path, str, str, str], None],
        progress_callback: Callable[[int, int, str], None],
        cancel_event: threading.Event,
    ) -> None:
        self.log_callback = log_callback
        self.status_callback = status_callback
        self.progress_callback = progress_callback
        self.cancel_event = cancel_event

    def ensure_tools(self) -> None:
        if not shutil.which("ffmpeg"):
            raise RuntimeError("ffmpeg가 설치되어 있지 않아 GIF 변환을 진행할 수 없습니다.")
        if not shutil.which("ffprobe"):
            raise RuntimeError("ffprobe가 설치되어 있지 않아 영상 정보를 읽을 수 없습니다.")

    def convert_batch(self, files: list[Path], settings: ConversionSettings) -> tuple[list[ConversionResult], Path | None, bool]:
        self.ensure_tools()
        results: list[ConversionResult] = []
        success_outputs: list[Path] = []
        used_names: set[str] = set()

        for index, input_path in enumerate(files, start=1):
            if self.cancel_event.is_set():
                raise ConversionCancelled()

            output_path = unique_output_path(input_path, settings.output_dir, used_names)
            self.progress_callback(index - 1, len(files), f"{index}/{len(files)} 파일 준비 중")
            result = self.convert_single(input_path, output_path, settings)
            results.append(result)

            if result.success and result.output_path:
                success_outputs.append(result.output_path)

            self.progress_callback(index, len(files), f"{index}/{len(files)} 파일 처리 완료")

        zip_path = None
        if settings.create_zip and success_outputs:
            if self.cancel_event.is_set():
                raise ConversionCancelled()
            zip_path = self.create_zip_archive(success_outputs, settings.output_dir)

        return results, zip_path, False

    def convert_single(self, input_path: Path, output_path: Path, settings: ConversionSettings) -> ConversionResult:
        video_info = self.probe_video(input_path)
        width = self.initial_width(video_info, settings.width)
        fps = self.initial_fps(video_info, settings.fps)
        colors = self.initial_colors(video_info)
        attempts = 0
        max_attempts = 14

        self.log_callback(
            f"[{input_path.name}] 분석 완료 - 길이 {video_info.duration_seconds:.1f}초 / 해상도 {video_info.width}x{video_info.height}"
        )

        while attempts < max_attempts:
            if self.cancel_event.is_set():
                raise ConversionCancelled()

            attempts += 1
            self.status_callback(input_path, f"변환 {attempts}차", output_path.name, "")
            self.log_callback(
                f"[{input_path.name}] {attempts}차 시도 - 너비 {width}px / FPS {fps} / 색상 {colors}"
            )

            self.run_ffmpeg(input_path, output_path, width=width, fps=fps, colors=colors)

            final_size = output_path.stat().st_size
            self.status_callback(input_path, f"크기 확인 {attempts}차", output_path.name, human_size(final_size))

            if final_size <= settings.target_bytes:
                message = f"완료 ({human_size(final_size)})"
                self.status_callback(input_path, "완료", output_path.name, human_size(final_size))
                self.log_callback(f"[{input_path.name}] 변환 완료 - {human_size(final_size)}")
                return ConversionResult(
                    input_path=input_path,
                    output_path=output_path,
                    success=True,
                    message=message,
                    final_size_bytes=final_size,
                )

            next_values = self.next_attempt_values(
                width=width,
                fps=fps,
                colors=colors,
                current_size=final_size,
                target_size=settings.target_bytes,
            )

            self.log_callback(
                f"[{input_path.name}] {human_size(final_size)}로 제한 초과, 자동 압축을 다시 시도합니다."
            )

            if not next_values:
                break

            width, fps, colors = next_values

        if output_path.exists():
            output_path.unlink()

        message = "20MB 이하로 맞추지 못했습니다. 더 짧은 구간으로 잘라서 다시 시도해 주세요."
        self.status_callback(input_path, "실패", output_path.name, "> 20MB")
        self.log_callback(f"[{input_path.name}] 실패 - {message}")
        return ConversionResult(
            input_path=input_path,
            output_path=None,
            success=False,
            message=message,
        )

    def probe_video(self, input_path: Path) -> VideoInfo:
        command = [
            "ffprobe",
            "-v",
            "error",
            "-show_streams",
            "-show_format",
            "-print_format",
            "json",
            str(input_path),
        ]
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=CREATE_NO_WINDOW,
            check=False,
        )

        if completed.returncode != 0:
            raise RuntimeError(f"{input_path.name} 정보를 읽지 못했습니다: {completed.stderr.strip()}")

        payload = json.loads(completed.stdout)
        streams = payload.get("streams", [])
        video_stream = next((item for item in streams if item.get("codec_type") == "video"), None)

        if not video_stream:
            raise RuntimeError(f"{input_path.name}에서 영상 스트림을 찾지 못했습니다.")

        width = int(video_stream.get("width") or 0)
        height = int(video_stream.get("height") or 0)
        duration = payload.get("format", {}).get("duration") or video_stream.get("duration") or 0

        return VideoInfo(width=width, height=height, duration_seconds=float(duration))

    def initial_width(self, video_info: VideoInfo, requested_width: int) -> int:
        width = min(video_info.width or requested_width, requested_width)

        if video_info.duration_seconds >= 60:
            width = min(width, 320)
        elif video_info.duration_seconds >= 30:
            width = min(width, 420)
        elif video_info.duration_seconds >= 15:
            width = min(width, 520)

        return even_number(max(MIN_WIDTH, width))

    def initial_fps(self, video_info: VideoInfo, requested_fps: int) -> int:
        fps = requested_fps

        if video_info.duration_seconds >= 60:
            fps = min(fps, 4)
        elif video_info.duration_seconds >= 30:
            fps = min(fps, 6)
        elif video_info.duration_seconds >= 15:
            fps = min(fps, 8)

        return max(MIN_FPS, fps)

    def initial_colors(self, video_info: VideoInfo) -> int:
        if video_info.duration_seconds >= 30:
            return 96
        if video_info.duration_seconds >= 15:
            return 128
        return 192

    def next_attempt_values(
        self,
        *,
        width: int,
        fps: int,
        colors: int,
        current_size: int,
        target_size: int,
    ) -> tuple[int, int, int] | None:
        if current_size <= target_size:
            return width, fps, colors

        ratio = target_size / current_size
        width_factor = max(0.40, min(0.94, ratio**0.35))
        fps_factor = max(0.55, min(0.96, ratio**0.22))

        new_width = even_number(max(MIN_WIDTH, int(width * width_factor)))
        new_fps = max(MIN_FPS, int(round(fps * fps_factor)))
        new_colors = colors

        if current_size > target_size * 1.6:
            new_colors = next_lower_color_step(colors)

        if new_width == width and new_fps == fps and new_colors == colors:
            if colors > COLOR_STEPS[-1]:
                new_colors = next_lower_color_step(colors)
            elif fps > MIN_FPS:
                new_fps = fps - 1
            elif width > MIN_WIDTH:
                new_width = even_number(max(MIN_WIDTH, width - 24))
            else:
                return None

        if new_width == width and new_fps == fps and new_colors == colors:
            return None

        return new_width, new_fps, new_colors

    def run_ffmpeg(self, input_path: Path, output_path: Path, *, width: int, fps: int, colors: int) -> None:
        filter_expression = (
            f"fps={fps},scale={width}:-1:flags=lanczos,split[s0][s1];"
            f"[s0]palettegen=stats_mode=diff:max_colors={colors}[p];"
            f"[s1][p]paletteuse=dither=sierra2_4a"
        )

        command = [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(input_path),
            "-an",
            "-sn",
            "-vf",
            filter_expression,
            "-loop",
            "0",
            str(output_path),
        ]

        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=CREATE_NO_WINDOW,
            check=False,
        )

        if completed.returncode != 0:
            if output_path.exists():
                output_path.unlink()
            raise RuntimeError(f"{input_path.name} GIF 변환 중 오류가 발생했습니다: {completed.stderr.strip()}")

    def create_zip_archive(self, gif_paths: list[Path], output_dir: Path) -> Path:
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        zip_path = output_dir / f"gif_batch_{timestamp}.zip"
        self.log_callback(f"ZIP 묶음 생성 중 - {zip_path.name}")

        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for gif_path in gif_paths:
                archive.write(gif_path, arcname=gif_path.name)

        self.log_callback(f"ZIP 생성 완료 - {zip_path.name}")
        return zip_path


class GifBatchApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title(APP_TITLE)
        self.root.geometry("1080x760")
        self.root.minsize(980, 700)
        self.root.configure(bg="#f4f1ea")

        self.file_paths: list[Path] = []
        self.file_to_item: dict[Path, str] = {}
        self.event_queue: queue.Queue[dict] = queue.Queue()
        self.worker_thread: threading.Thread | None = None
        self.cancel_event = threading.Event()

        self.output_dir_var = tk.StringVar(value=str(Path.cwd() / "output_gifs"))
        self.fps_var = tk.IntVar(value=10)
        self.width_var = tk.IntVar(value=640)
        self.zip_var = tk.BooleanVar(value=True)
        self.status_var = tk.StringVar(value="영상 파일을 추가한 뒤 변환을 시작하세요.")

        self.build_style()
        self.build_ui()
        self.root.after(100, self.process_events)

    def build_style(self) -> None:
        style = ttk.Style()
        style.theme_use("clam")

        style.configure("Main.TFrame", background="#f4f1ea")
        style.configure("Card.TFrame", background="#fffdf8", relief="flat")
        style.configure("Accent.TButton", padding=(16, 10), font=("Malgun Gothic", 10, "bold"))
        style.configure("Treeview", font=("Malgun Gothic", 10), rowheight=30)
        style.configure("Treeview.Heading", font=("Malgun Gothic", 10, "bold"))
        style.configure("Header.TLabel", background="#f4f1ea", foreground="#2c2a27", font=("Malgun Gothic", 19, "bold"))
        style.configure("Sub.TLabel", background="#f4f1ea", foreground="#5d574f", font=("Malgun Gothic", 10))
        style.configure("Section.TLabel", background="#fffdf8", foreground="#24201c", font=("Malgun Gothic", 11, "bold"))

    def build_ui(self) -> None:
        container = ttk.Frame(self.root, style="Main.TFrame", padding=18)
        container.pack(fill="both", expand=True)

        header = ttk.Frame(container, style="Main.TFrame")
        header.pack(fill="x", pady=(0, 16))

        ttk.Label(header, text="네이버 블로그용 GIF 일괄 변환기", style="Header.TLabel").pack(anchor="w")
        ttk.Label(
            header,
            text="여러 영상을 한 번에 불러와 GIF로 만들고, 파일당 20MB를 넘으면 자동으로 품질을 조정합니다.",
            style="Sub.TLabel",
        ).pack(anchor="w", pady=(4, 0))

        body = ttk.Frame(container, style="Main.TFrame")
        body.pack(fill="both", expand=True)

        left = ttk.Frame(body, style="Card.TFrame", padding=16)
        left.pack(side="left", fill="both", expand=True)

        right = ttk.Frame(body, style="Card.TFrame", padding=16)
        right.pack(side="left", fill="y", padx=(16, 0))

        self.build_file_section(left)
        self.build_log_section(left)
        self.build_control_section(right)

    def build_file_section(self, parent: ttk.Frame) -> None:
        ttk.Label(parent, text="변환할 영상", style="Section.TLabel").pack(anchor="w")

        toolbar = ttk.Frame(parent, style="Card.TFrame")
        toolbar.pack(fill="x", pady=(10, 10))

        self.add_button = ttk.Button(toolbar, text="영상 추가", command=self.add_files, style="Accent.TButton")
        self.add_button.pack(side="left")
        self.remove_button = ttk.Button(toolbar, text="선택 삭제", command=self.remove_selected)
        self.remove_button.pack(side="left", padx=8)
        self.clear_button = ttk.Button(toolbar, text="전체 비우기", command=self.clear_files)
        self.clear_button.pack(side="left")

        columns = ("name", "status", "output", "size")
        self.tree = ttk.Treeview(parent, columns=columns, show="headings", height=12)
        self.tree.heading("name", text="파일명")
        self.tree.heading("status", text="상태")
        self.tree.heading("output", text="출력 GIF")
        self.tree.heading("size", text="크기")
        self.tree["displaycolumns"] = ("name", "status", "output", "size")

        self.tree.pack(fill="both", expand=True)
        self.tree.column("name", width=320, anchor="w")
        self.tree.column("status", width=150, anchor="center")
        self.tree.column("output", width=260, anchor="w")
        self.tree.column("size", width=110, anchor="center")

        file_name_frame = ttk.Frame(parent, style="Card.TFrame")
        file_name_frame.pack(fill="x", pady=(8, 0))

        ttk.Label(
            file_name_frame,
            text="파일명은 아래 로그에 원본 경로와 함께 표시됩니다. 같은 이름의 파일은 자동으로 번호를 붙여 저장합니다.",
            style="Sub.TLabel",
        ).pack(anchor="w")

    def build_log_section(self, parent: ttk.Frame) -> None:
        ttk.Label(parent, text="작업 로그", style="Section.TLabel").pack(anchor="w", pady=(18, 0))

        self.log_text = scrolledtext.ScrolledText(
            parent,
            wrap="word",
            height=11,
            font=("Consolas", 10),
            bg="#fbfaf7",
            fg="#2c2a27",
            relief="flat",
            padx=10,
            pady=10,
        )
        self.log_text.pack(fill="both", expand=True, pady=(10, 0))
        self.log_text.configure(state="disabled")

    def build_control_section(self, parent: ttk.Frame) -> None:
        ttk.Label(parent, text="설정", style="Section.TLabel").pack(anchor="w")

        output_card = ttk.Frame(parent, style="Card.TFrame")
        output_card.pack(fill="x", pady=(14, 20))

        ttk.Label(output_card, text="저장 폴더", style="Section.TLabel").pack(anchor="w")
        entry_frame = ttk.Frame(output_card, style="Card.TFrame")
        entry_frame.pack(fill="x", pady=(8, 0))

        ttk.Entry(entry_frame, textvariable=self.output_dir_var, width=40).pack(side="left", fill="x", expand=True)
        ttk.Button(entry_frame, text="폴더 선택", command=self.choose_output_dir).pack(side="left", padx=6)
        ttk.Button(entry_frame, text="폴더 열기", command=self.open_output_dir).pack(side="left")

        option_card = ttk.Frame(parent, style="Card.TFrame")
        option_card.pack(fill="x")

        ttk.Label(option_card, text="기본 품질", style="Section.TLabel").pack(anchor="w")

        fps_row = ttk.Frame(option_card, style="Card.TFrame")
        fps_row.pack(fill="x", pady=(10, 6))
        ttk.Label(fps_row, text="FPS", width=14).pack(side="left")
        ttk.Spinbox(fps_row, from_=1, to=20, textvariable=self.fps_var, width=8).pack(side="left")

        width_row = ttk.Frame(option_card, style="Card.TFrame")
        width_row.pack(fill="x", pady=6)
        ttk.Label(width_row, text="가로 너비(px)", width=14).pack(side="left")
        ttk.Spinbox(width_row, from_=120, to=1920, increment=20, textvariable=self.width_var, width=8).pack(side="left")

        zip_row = ttk.Frame(option_card, style="Card.TFrame")
        zip_row.pack(fill="x", pady=(6, 0))
        ttk.Checkbutton(zip_row, text="완료 후 GIF를 ZIP으로 한 번 더 묶기", variable=self.zip_var).pack(anchor="w")

        note_card = ttk.Frame(parent, style="Card.TFrame")
        note_card.pack(fill="x", pady=(20, 20))

        ttk.Label(note_card, text="용량 제한 안내", style="Section.TLabel").pack(anchor="w")
        ttk.Label(
            note_card,
            text="파일당 20MB를 넘기지 않도록 자동 조절합니다. 영상이 길수록 해상도와 FPS가 더 낮아질 수 있습니다.",
            style="Sub.TLabel",
            wraplength=280,
            justify="left",
        ).pack(anchor="w", pady=(8, 0))
        ttk.Label(
            note_card,
            text="블로그용이라면 3초~15초 정도의 짧은 클립이 가장 안정적입니다.",
            style="Sub.TLabel",
            wraplength=280,
            justify="left",
        ).pack(anchor="w", pady=(6, 0))

        action_card = ttk.Frame(parent, style="Card.TFrame")
        action_card.pack(fill="x")

        self.start_button = ttk.Button(action_card, text="일괄 변환 시작", command=self.start_conversion, style="Accent.TButton")
        self.start_button.pack(fill="x")

        self.cancel_button = ttk.Button(action_card, text="작업 취소", command=self.cancel_conversion, state="disabled")
        self.cancel_button.pack(fill="x", pady=(8, 0))

        self.progress = ttk.Progressbar(parent, mode="determinate")
        self.progress.pack(fill="x", pady=(18, 8))

        ttk.Label(parent, textvariable=self.status_var, style="Sub.TLabel", wraplength=300, justify="left").pack(anchor="w")

    def add_files(self) -> None:
        selected = filedialog.askopenfilenames(
            title="영상 파일 선택",
            filetypes=[
                ("영상 파일", " ".join(VIDEO_FILETYPES)),
                ("모든 파일", "*.*"),
            ],
        )
        if not selected:
            return

        for raw_path in selected:
            path = Path(raw_path)
            if path in self.file_paths:
                continue

            self.file_paths.append(path)
            item_id = self.tree.insert("", "end", values=(path.name, "대기 중", "-", "-"))
            self.file_to_item[path] = item_id
            self.append_log(f"[추가] {path}")

        self.status_var.set(f"{len(self.file_paths)}개의 영상이 목록에 등록되었습니다.")

    def remove_selected(self) -> None:
        selected_items = self.tree.selection()
        if not selected_items:
            return

        to_remove: list[Path] = []
        for path, item_id in self.file_to_item.items():
            if item_id in selected_items:
                to_remove.append(path)

        for path in to_remove:
            item_id = self.file_to_item.pop(path)
            self.tree.delete(item_id)
            self.file_paths.remove(path)
            self.append_log(f"[삭제] {path}")

        self.status_var.set(f"{len(self.file_paths)}개의 영상이 남아 있습니다.")

    def clear_files(self) -> None:
        if self.worker_thread and self.worker_thread.is_alive():
            messagebox.showwarning(APP_TITLE, "변환 중에는 전체 비우기를 할 수 없습니다.")
            return

        self.file_paths.clear()
        self.file_to_item.clear()
        for item in self.tree.get_children():
            self.tree.delete(item)
        self.append_log("[초기화] 등록된 영상 목록을 비웠습니다.")
        self.status_var.set("영상 파일을 추가한 뒤 변환을 시작하세요.")

    def choose_output_dir(self) -> None:
        selected = filedialog.askdirectory(title="출력 폴더 선택", initialdir=self.output_dir_var.get())
        if selected:
            self.output_dir_var.set(selected)

    def open_output_dir(self) -> None:
        output_dir = Path(self.output_dir_var.get())
        output_dir.mkdir(parents=True, exist_ok=True)
        os.startfile(output_dir)

    def start_conversion(self) -> None:
        if self.worker_thread and self.worker_thread.is_alive():
            return

        if not self.file_paths:
            messagebox.showwarning(APP_TITLE, "먼저 변환할 영상을 하나 이상 추가해 주세요.")
            return

        missing = [str(path) for path in self.file_paths if not path.exists()]
        if missing:
            messagebox.showerror(APP_TITLE, "목록에 없는 파일이 섞여 있습니다. 목록을 다시 확인해 주세요.")
            return

        output_dir = Path(self.output_dir_var.get())
        output_dir.mkdir(parents=True, exist_ok=True)

        settings = ConversionSettings(
            output_dir=output_dir,
            fps=max(MIN_FPS, int(self.fps_var.get())),
            width=max(120, int(self.width_var.get())),
            create_zip=bool(self.zip_var.get()),
        )

        self.cancel_event.clear()
        self.progress.configure(value=0, maximum=len(self.file_paths))
        self.toggle_controls(is_running=True)
        self.status_var.set("GIF 일괄 변환을 시작했습니다.")

        for path in self.file_paths:
            item_id = self.file_to_item[path]
            self.tree.item(item_id, values=(path.name, "대기 중", "-", "-"))

        worker_files = list(self.file_paths)
        self.worker_thread = threading.Thread(
            target=self.run_worker,
            args=(worker_files, settings),
            daemon=True,
        )
        self.worker_thread.start()

    def cancel_conversion(self) -> None:
        if not self.worker_thread or not self.worker_thread.is_alive():
            return
        self.cancel_event.set()
        self.status_var.set("현재 작업이 끝나는 대로 취소합니다.")
        self.append_log("[취소 요청] 현재 작업이 끝난 뒤 일괄 변환을 멈춥니다.")

    def toggle_controls(self, *, is_running: bool) -> None:
        start_state = "disabled" if is_running else "normal"
        cancel_state = "normal" if is_running else "disabled"
        other_state = "disabled" if is_running else "normal"
        self.start_button.configure(state=start_state)
        self.cancel_button.configure(state=cancel_state)
        self.add_button.configure(state=other_state)
        self.remove_button.configure(state=other_state)
        self.clear_button.configure(state=other_state)

    def run_worker(self, files: list[Path], settings: ConversionSettings) -> None:
        converter = GifBatchConverter(
            log_callback=lambda message: self.event_queue.put({"type": "log", "message": message}),
            status_callback=lambda path, status, output, size: self.event_queue.put(
                {
                    "type": "status",
                    "path": str(path),
                    "status": status,
                    "output": output,
                    "size": size,
                }
            ),
            progress_callback=lambda value, total, message: self.event_queue.put(
                {
                    "type": "progress",
                    "value": value,
                    "maximum": total,
                    "message": message,
                }
            ),
            cancel_event=self.cancel_event,
        )

        try:
            results, zip_path, cancelled = converter.convert_batch(files, settings)
            self.event_queue.put(
                {
                    "type": "done",
                    "results": results,
                    "zip_path": str(zip_path) if zip_path else "",
                    "cancelled": cancelled,
                }
            )
        except ConversionCancelled:
            self.event_queue.put({"type": "cancelled"})
        except Exception as error:
            self.event_queue.put({"type": "error", "message": str(error)})

    def process_events(self) -> None:
        try:
            while True:
                event = self.event_queue.get_nowait()
                event_type = event["type"]

                if event_type == "log":
                    self.append_log(event["message"])
                elif event_type == "status":
                    self.update_file_status(
                        Path(event["path"]),
                        event["status"],
                        event["output"],
                        event["size"],
                    )
                elif event_type == "progress":
                    self.progress.configure(value=event["value"], maximum=event["maximum"])
                    self.status_var.set(event["message"])
                elif event_type == "done":
                    self.handle_done(event["results"], event["zip_path"])
                elif event_type == "cancelled":
                    self.handle_cancelled()
                elif event_type == "error":
                    self.handle_error(event["message"])
        except queue.Empty:
            pass

        self.root.after(100, self.process_events)

    def handle_done(self, results: list[ConversionResult], zip_path: str) -> None:
        self.toggle_controls(is_running=False)
        success_count = sum(1 for result in results if result.success)
        failed_count = len(results) - success_count

        if zip_path:
            self.append_log(f"[완료] ZIP 묶음 생성: {zip_path}")

        self.status_var.set(f"작업 완료 - 성공 {success_count}개 / 실패 {failed_count}개")
        message_parts = [f"GIF 변환 완료\n성공: {success_count}개\n실패: {failed_count}개"]
        if zip_path:
            message_parts.append(f"ZIP 파일: {zip_path}")

        messagebox.showinfo(APP_TITLE, "\n\n".join(message_parts))

    def handle_cancelled(self) -> None:
        self.toggle_controls(is_running=False)
        self.status_var.set("사용자 요청으로 작업을 취소했습니다.")
        self.append_log("[취소 완료] 진행 중이던 작업을 멈췄습니다.")
        messagebox.showinfo(APP_TITLE, "GIF 변환 작업을 취소했습니다.")

    def handle_error(self, message: str) -> None:
        self.toggle_controls(is_running=False)
        self.status_var.set("오류가 발생해 작업을 중단했습니다.")
        self.append_log(f"[오류] {message}")
        messagebox.showerror(APP_TITLE, message)

    def update_file_status(self, path: Path, status: str, output: str, size: str) -> None:
        item_id = self.file_to_item.get(path)
        if not item_id:
            return
        self.tree.item(item_id, values=(path.name, status, output or "-", size or "-"))

    def append_log(self, message: str) -> None:
        timestamp = time.strftime("%H:%M:%S")
        self.log_text.configure(state="normal")
        self.log_text.insert("end", f"[{timestamp}] {message}\n")
        self.log_text.see("end")
        self.log_text.configure(state="disabled")


def main() -> None:
    root = tk.Tk()
    app = GifBatchApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
