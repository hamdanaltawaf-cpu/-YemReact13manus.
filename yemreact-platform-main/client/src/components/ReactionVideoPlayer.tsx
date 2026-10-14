import React, { useRef, useState } from "react";
import { Expand, Pause, Play, Volume2, VolumeX } from "lucide-react";

export function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function ReactionVideoPlayer({ src, poster, label }: { src: string; poster?: string | null; label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [aspectRatio, setAspectRatio] = useState("16 / 9");

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) await video.play().catch(() => undefined);
    else video.pause();
  };
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };
  const seekTo = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  };
  const toggleFullscreen = async () => {
    const player = playerRef.current;
    if (!player) return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    else await player.requestFullscreen?.().catch(() => undefined);
  };

  return <div ref={playerRef} className="reaction-player" style={{ aspectRatio }} dir="rtl" aria-label={`مشغل فيديو: ${label}`}>
    <video ref={videoRef} className="reaction-player__media" src={src} poster={poster ?? undefined} playsInline preload="metadata" onClick={togglePlayback} onLoadedMetadata={event => { const video = event.currentTarget; setDuration(video.duration); if (video.videoWidth && video.videoHeight) setAspectRatio(`${video.videoWidth} / ${video.videoHeight}`); }} onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onVolumeChange={event => setIsMuted(event.currentTarget.muted)}>
      متصفحك لا يدعم تشغيل الفيديو.
    </video>
    <button type="button" className="reaction-player__tap-target" aria-label={isPlaying ? "إيقاف الفيديو مؤقتًا" : "تشغيل الفيديو"} onClick={togglePlayback} />
    <div className="reaction-player__controls" onClick={event => event.stopPropagation()}>
      <div className="reaction-player__timeline"><input type="range" min="0" max={duration || 0} step="0.05" value={Math.min(currentTime, duration || 0)} aria-label="تقدم الفيديو" onChange={event => seekTo(Number(event.target.value))} style={{ "--progress": `${duration ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties} /></div>
      <div className="reaction-player__control-row"><button type="button" onClick={togglePlayback} aria-label={isPlaying ? "إيقاف مؤقت" : "تشغيل"}>{isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><span className="reaction-player__time" dir="ltr">{formatTime(currentTime)} / {formatTime(duration)}</span><span className="reaction-player__spacer" /><button type="button" onClick={toggleMute} aria-label={isMuted ? "تشغيل الصوت" : "كتم الصوت"}>{isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button><button type="button" onClick={toggleFullscreen} aria-label="ملء الشاشة"><Expand size={18} /></button></div>
    </div>
  </div>;
}
