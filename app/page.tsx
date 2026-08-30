'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Activity,
  AudioLines,
  BarChart3,
  BookOpenText,
  CircleStop,
  CircleUserRound,
  Clock3,
  Download,
  Headphones,
  LayoutDashboard,
  Lightbulb,
  Mic2,
  Music2,
  Pause,
  RefreshCw,
  Shuffle,
  Sparkles,
  SquareActivity,
  Target,
  Trophy,
  Users,
  Volume2,
  WandSparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

type View = 'today' | 'pronunciation' | 'speech' | 'growth' | 'teacher';
type Phase = 'idle' | 'preparing' | 'recording' | 'analyzing' | 'result';

type SpeechRecognitionResultLike = {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  start: () => void;
  stop: () => void;
};

const topics = [
  {
    title: '当人工智能进入课堂，教师最不可替代的能力是什么？',
    cue: '建议从一个真实课堂片段出发，表达观点，并用具体例子说明理由。',
  },
  {
    title: '如果可以给一年后的自己留一句话，你会说什么？',
    cue: '使用“经历—认识—行动”的结构，让内容更有层次。',
  },
  {
    title: '快节奏生活中，我们是否还需要耐心？',
    cue: '先给出清晰立场，再用正反两个例子支撑观点。',
  },
  {
    title: '一次失败，怎样才能真正变成成长？',
    cue: '讲述一件具体小事，避免只说抽象道理。',
  },
];

const readingText = '语言是思想的声音。清晰准确的表达，不仅能够传递信息，也能够建立理解、赢得信任。';
const waveform = [24, 41, 64, 38, 76, 52, 86, 46, 68, 32, 58, 78, 44, 64, 28, 49, 72, 36, 57, 31, 66, 43];
const teacherRows = [
  ['林晓雨', '5次', '86', '+12', '前后鼻音'],
  ['周子涵', '4次', '82', '+9', '语速偏快'],
  ['陈一诺', '3次', '79', '+7', '平翘舌'],
  ['王嘉言', '5次', '88', '+14', '结构完整度'],
];

const teacherStats: Array<[typeof Users, string, string]> = [
  [Users, '32', '本周参与学生'],
  [Mic2, '126', '完成训练'],
  [BarChart3, '81.4', '班级平均分'],
  [Activity, '+9.6', '平均提升'],
];

const navItems: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'today', label: '今日训练', icon: LayoutDashboard },
  { id: 'pronunciation', label: '普通话纠音', icon: AudioLines },
  { id: 'speech', label: '即兴演讲', icon: Mic2 },
  { id: 'growth', label: '成长档案', icon: Trophy },
  { id: 'teacher', label: '教师看板', icon: Users },
];

const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export default function Home() {
  const [view, setView] = useState<View>('today');
  const [phase, setPhase] = useState<Phase>('idle');
  const [topicIndex, setTopicIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [micError, setMicError] = useState('');
  const [attempt, setAttempt] = useState(1);
  const [musicMode, setMusicMode] = useState('温暖叙事');
  const [musicPlaying, setMusicPlaying] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicNodesRef = useRef<OscillatorNode[]>([]);

  const isPronunciation = view === 'pronunciation';
  const isTraining = view === 'today' || view === 'pronunciation' || view === 'speech';
  const activeTopic = topics[topicIndex];

  useEffect(() => {
    if (phase !== 'preparing' && phase !== 'recording') return;
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (phase === 'preparing' && current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return phase === 'preparing' ? current - 1 : current + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    stopMusic();
  }, [audioUrl]);

  const result = useMemo(() => {
    const duration = Math.max(seconds, 42);
    const spokenLength = transcript.replace(/[\s，。！？、]/g, '').length || 146;
    const speed = Math.round((spokenLength / duration) * 60);
    const paceScore = Math.max(68, Math.min(92, 90 - Math.abs(speed - 180) / 3));
    const clarity = Math.min(94, 79 + attempt * 4);
    const fluency = Math.round(paceScore);
    const structure = isPronunciation ? 88 : Math.min(91, 72 + attempt * 5);
    return {
      overall: Math.round(clarity * .4 + fluency * .3 + structure * .3),
      clarity,
      fluency,
      structure,
      speed,
      pauses: attempt === 1 ? 6 : 3,
      fillers: attempt === 1 ? 8 : 3,
    };
  }, [attempt, isPronunciation, seconds, transcript]);

  function resetTraining(nextView?: View) {
    setPhase('idle');
    setSeconds(0);
    setTranscript('');
    setMicError('');
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl('');
    if (nextView) setView(nextView);
  }

  function chooseView(nextView: View) {
    if (phase === 'recording') stopRecording();
    resetTraining(nextView);
  }

  function beginPreparation() {
    setMicError('');
    setSeconds(isPronunciation ? 15 : 60);
    setPhase('preparing');
  }

  async function startRecording() {
    setMicError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(blob));
      };
      recorder.start();
      const Recognition = (window as typeof window & { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
      if (Recognition) {
        const recognition = new Recognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          let next = '';
          for (let index = 0; index < event.results.length; index += 1) next += event.results[index][0].transcript;
          setTranscript(next);
        };
        recognitionRef.current = recognition;
        recognition.start();
      }
      setSeconds(0);
      setPhase('recording');
    } catch {
      setMicError('未能获取麦克风权限。请允许浏览器使用麦克风后再试。');
      setPhase('idle');
      setSeconds(0);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recognitionRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setPhase('analyzing');
    window.setTimeout(() => setPhase('result'), 1400);
  }

  function retryTraining() {
    setAttempt((current) => current + 1);
    resetTraining();
  }

  function shuffleTopic() {
    setTopicIndex((current) => (current + 1) % topics.length);
    resetTraining();
  }

  function toggleMusic() {
    if (musicPlaying) {
      stopMusic();
      setMusicPlaying(false);
      return;
    }
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    audioContextRef.current = context;
    const master = context.createGain();
    master.gain.setValueAtTime(.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(.035, context.currentTime + 1.2);
    master.connect(context.destination);
    const chordMap: Record<string, number[]> = {
      '温暖叙事': [261.63, 329.63, 392],
      '坚定励志': [293.66, 369.99, 440],
      '沉静思考': [220, 261.63, 329.63],
    };
    const nodes = (chordMap[musicMode] || chordMap['温暖叙事']).map((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency / (index === 0 ? 2 : 1);
      gain.gain.value = index === 0 ? .55 : .18;
      oscillator.connect(gain).connect(master);
      oscillator.start();
      return oscillator;
    });
    musicNodesRef.current = nodes;
    setMusicPlaying(true);
  }

  function stopMusic() {
    musicNodesRef.current.forEach((node) => {
      try { node.stop(); } catch { /* already stopped */ }
    });
    musicNodesRef.current = [];
    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }

  return (
    <main className="site-shell min-h-screen text-foreground">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <header className="topbar">
        <button className="brand-mark" onClick={() => chooseView('today')} aria-label="返回今日训练">
          <span className="brand-icon"><AudioLines className="size-5" /></span>
          <span><strong>声动课堂</strong><small>VOICE LAB · 2026</small></span>
        </button>
        <div className="topbar-meta"><span className="status-dot" />课堂训练系统已就绪</div>
        <button className="profile-pill" aria-label="个人中心"><span>连续训练 4 天</span><CircleUserRound className="size-5" /></button>
      </header>

      <section className="workspace">
        <div className="masthead">
          <div>
            <p className="masthead-kicker">AI SPEECH TRAINING SYSTEM</p>
            <h1>{view === 'teacher' ? '看见每一次成长' : view === 'growth' ? '声音会留下轨迹' : '让表达，被听见。'}</h1>
          </div>
          <p className="masthead-note">普通话纠音 × 即兴演讲 × 录音诊断<br />为真实《演讲与口才》课堂而设计</p>
        </div>

        <div className="floating-nav-wrap">
          <nav className="floating-nav" aria-label="主要功能">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => chooseView(id)} className={view === id ? 'active' : ''}>
                <Icon className="size-[17px]" /><span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <section className="view-stage" key={view}>
          {isTraining && (
            <TrainingView
              view={view}
              phase={phase}
              topic={activeTopic}
              isPronunciation={isPronunciation}
              seconds={seconds}
              transcript={transcript}
              audioUrl={audioUrl}
              micError={micError}
              attempt={attempt}
              result={result}
              musicMode={musicMode}
              musicPlaying={musicPlaying}
              onMusicMode={setMusicMode}
              onToggleMusic={toggleMusic}
              onStartPreparation={beginPreparation}
              onStartRecording={() => void startRecording()}
              onStopRecording={stopRecording}
              onRetry={retryTraining}
              onShuffle={shuffleTopic}
            />
          )}
          {view === 'growth' && <GrowthView />}
          {view === 'teacher' && <TeacherView />}
        </section>
      </section>
      <footer className="site-footer"><span>声动课堂 · AI辅助演讲与口才训练</span><span>真实训练 · 教师复核 · 持续成长</span></footer>
    </main>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div><p>{eyebrow}</p><h2>{title}</h2>{description && <span>{description}</span>}</div>{action}
    </div>
  );
}

function TrainingView(props: {
  view: View;
  phase: Phase;
  topic: (typeof topics)[number];
  isPronunciation: boolean;
  seconds: number;
  transcript: string;
  audioUrl: string;
  micError: string;
  attempt: number;
  result: { overall: number; clarity: number; fluency: number; structure: number; speed: number; pauses: number; fillers: number };
  musicMode: string;
  musicPlaying: boolean;
  onMusicMode: (mode: string) => void;
  onToggleMusic: () => void;
  onStartPreparation: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onRetry: () => void;
  onShuffle: () => void;
}) {
  const { phase, topic, isPronunciation, seconds, transcript, audioUrl, micError, attempt, result } = props;
  const title = props.view === 'today' ? '今天，练一次有力量的表达' : isPronunciation ? '把每一个音，说清楚' : '用两分钟，讲清一个观点';
  const eyebrow = props.view === 'today' ? "TODAY'S PRACTICE" : isPronunciation ? 'PRONUNCIATION LAB' : 'IMPROMPTU SPEECH';
  return (
    <div className="view-content">
      <PageHeading eyebrow={eyebrow} title={title} description={isPronunciation ? '跟读标准文本，获得字词、语速、停顿和流畅度分析。' : '从真实话题出发，完成准备、表达、诊断和二次改进。'} action={!isPronunciation ? <Button onClick={props.onShuffle} variant="outline" className="h-10 self-start rounded-xl px-4 sm:self-auto"><Shuffle /> 换一个训练题</Button> : undefined} />

      {phase !== 'result' ? (
        <div className="training-grid">
          <article className="training-card">
            <div className="training-card-top">
              <div className="flex items-center gap-2.5"><Badge className="bg-[#12262b] px-2.5">{isPronunciation ? '专项朗读' : '即兴演讲'}</Badge><span className="text-xs text-muted-foreground">第 {attempt} 次训练</span></div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{isPronunciation ? '建议朗读 30 秒' : '准备 60 秒 · 演讲 2 分钟'}</div>
            </div>
            <div className="training-card-body">
              <div className="flex items-start gap-4"><div className="hidden size-11 shrink-0 place-items-center rounded-2xl bg-[#fff0ec] text-[#e85d44] sm:grid"><BookOpenText className="size-5" /></div><div><p className="text-xs font-medium text-muted-foreground">{isPronunciation ? '朗读文本' : '今日题目'}</p><h2 className="mt-2 max-w-3xl text-xl font-semibold leading-relaxed md:text-[26px]">{isPronunciation ? readingText : topic.title}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{isPronunciation ? '请自然朗读，不必刻意放慢；系统将重点关注前后鼻音、平翘舌和停顿。' : topic.cue}</p></div></div>
              <Recorder phase={phase} seconds={seconds} transcript={transcript} error={micError} isPronunciation={isPronunciation} onPrepare={props.onStartPreparation} onRecord={props.onStartRecording} onStop={props.onStopRecording} />
            </div>
          </article>
          <aside className="side-stack"><WeeklyGrowth /><TipCard isPronunciation={isPronunciation} /></aside>
        </div>
      ) : (
        <ResultView result={result} transcript={transcript} audioUrl={audioUrl} attempt={attempt} musicMode={props.musicMode} musicPlaying={props.musicPlaying} onMusicMode={props.onMusicMode} onToggleMusic={props.onToggleMusic} onRetry={props.onRetry} />
      )}
    </div>
  );
}

function Recorder({ phase, seconds, transcript, error, isPronunciation, onPrepare, onRecord, onStop }: { phase: Phase; seconds: number; transcript: string; error: string; isPronunciation: boolean; onPrepare: () => void; onRecord: () => void; onStop: () => void }) {
  return (
    <div className={`mt-8 rounded-2xl p-5 transition md:p-6 ${phase === 'recording' ? 'bg-[#fff1ed]' : 'bg-[#f3f7f5]'}`}>
      <div className="flex h-24 items-center justify-center gap-[5px]" aria-label="语音波形">
        {waveform.map((height, index) => <span key={`${height}-${index}`} className={`w-[5px] rounded-full ${phase === 'recording' ? 'animate-pulse bg-[#ef6248]/70' : 'bg-[#2c7b72]/55'}`} style={{ height: `${phase === 'recording' ? Math.max(18, (height + seconds * (index % 4 + 1)) % 92) : height}%`, animationDelay: `${index * 45}ms` }} />)}
      </div>
      <div className="mt-1 text-center">
        {phase === 'preparing' && <><p className="text-4xl font-semibold tabular-nums text-[#173037]">{seconds}</p><p className="mt-1 text-xs text-muted-foreground">准备时间</p></>}
        {phase === 'recording' && <><p className="text-2xl font-semibold tabular-nums text-[#d95740]">{formatTime(seconds)}</p><p className="mt-1 text-xs text-muted-foreground">正在录音 · 请保持自然表达</p></>}
        {phase === 'analyzing' && <><RefreshCw className="mx-auto size-7 animate-spin text-[#2f8177]" /><p className="mt-2 text-sm font-medium">正在生成训练诊断</p></>}
      </div>
      {transcript && phase === 'recording' && <p className="mx-auto mt-4 line-clamp-2 max-w-2xl rounded-xl bg-white/80 px-4 py-3 text-left text-xs leading-5 text-muted-foreground">实时转写：{transcript}</p>}
      <div className="mt-4 flex flex-col items-center">
        {phase === 'idle' && <Button onClick={onPrepare} className="h-12 rounded-full bg-[#ef6248] px-7 text-[15px] text-white shadow-[0_9px_22px_rgba(239,98,72,.23)] hover:bg-[#dc553d]"><Mic2 className="size-5" />开始{isPronunciation ? '朗读' : '准备'}</Button>}
        {phase === 'preparing' && <Button onClick={onRecord} className="h-11 rounded-full bg-[#173037] px-6 text-white"><Mic2 />提前开始录音</Button>}
        {phase === 'recording' && <Button onClick={onStop} className="h-12 rounded-full bg-[#ef6248] px-7 text-white hover:bg-[#dc553d]"><CircleStop className="size-5" />结束并诊断</Button>}
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        {phase === 'idle' && <p className="mt-3 text-xs text-muted-foreground">录音仅用于本次训练；MVP版本默认保存在当前设备</p>}
      </div>
    </div>
  );
}

function WeeklyGrowth() {
  return (
    <div className="rounded-[22px] border border-border bg-card p-5 shadow-[0_14px_38px_rgba(26,48,51,.05)]"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">本周成长</p><p className="mt-1 text-xs text-muted-foreground">相比上周提升 11%</p></div><Sparkles className="size-5 text-[#ef6248]" /></div><div className="mt-6 space-y-5">{[['发音清晰度',86,'#2f8177'],['表达流畅度',74,'#e26b52'],['结构完整度',68,'#d8a346']].map(([label,value,color]) => <MetricBar key={label as string} label={label as string} value={value as number} color={color as string} />)}</div></div>
  );
}

function TipCard({ isPronunciation }: { isPronunciation: boolean }) {
  return (
    <div className="flex w-full items-center gap-4 rounded-[22px] border border-border bg-[#fffaf3] p-5"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#ffe9d2] text-[#a6601c]"><Lightbulb className="size-5" /></div><div><p className="text-sm font-semibold">{isPronunciation ? '朗读小提示' : '表达结构提示'}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{isPronunciation ? '先看完整句意，再按语义自然停顿。' : '观点先行，用一个具体例子支撑，结尾回扣题目。'}</p></div></div>
  );
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return <div><div className="mb-2 flex items-center justify-between text-xs"><span>{label}</span><span className="font-semibold tabular-nums">{value}</span></div><Progress value={value} className="[&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-indicator]]:bg-[var(--bar-color)]" style={{ '--bar-color': color } as CSSProperties} /></div>;
}

function ResultView({ result, transcript, audioUrl, attempt, musicMode, musicPlaying, onMusicMode, onToggleMusic, onRetry }: { result: { overall: number; clarity: number; fluency: number; structure: number; speed: number; pauses: number; fillers: number }; transcript: string; audioUrl: string; attempt: number; musicMode: string; musicPlaying: boolean; onMusicMode: (mode: string) => void; onToggleMusic: () => void; onRetry: () => void }) {
  return (
    <div className="result-grid grid gap-5 xl:grid-cols-[.82fr_1.18fr]">
      <div className="score-card rounded-[34px] bg-[#173037] p-6 text-white shadow-[0_18px_45px_rgba(20,48,53,.16)] md:p-8">
        <div className="flex items-center justify-between"><Badge className="bg-white/12 text-white">第 {attempt} 次诊断</Badge><WandSparkles className="size-5 text-[#ff8a72]" /></div>
        <div className="mt-8 flex items-end gap-3"><span className="text-6xl font-semibold tracking-tight">{result.overall}</span><span className="pb-2 text-sm text-white/55">综合表现</span></div>
        <p className="mt-4 text-sm leading-6 text-white/67">你的观点表达清晰，语速基本合适。下一次重点减少填充词，并让结尾更有收束感。</p>
        <div className="mt-7 grid grid-cols-3 gap-2">{[['清晰度',result.clarity],['流畅度',result.fluency],['完整度',result.structure]].map(([label,value]) => <div key={label as string} className="rounded-2xl bg-white/8 px-3 py-4 text-center"><p className="text-xl font-semibold">{value}</p><p className="mt-1 text-[11px] text-white/52">{label}</p></div>)}</div>
        {/* The user's own recording is paired with the visible transcript when supported. */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        {audioUrl && <audio className="mt-6 w-full" controls src={audioUrl} />}
      </div>
      <div className="space-y-5">
        <div className="glass-card rounded-[32px] border border-border bg-card p-5 md:p-7">
          <div className="flex items-center justify-between"><div><p className="font-semibold">AI诊断建议</p><p className="mt-1 text-xs text-muted-foreground">从可操作的小问题开始改进</p></div><Badge variant="secondary">本地演示分析</Badge></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InsightCard icon={Activity} title={`语速 ${result.speed} 字/分钟`} text={result.speed > 195 ? '整体偏快，建议关键观点前停顿半秒。' : '处于自然表达区间，重点句可以略微放慢。'} tone="teal" />
            <InsightCard icon={Pause} title={`不当停顿 ${result.pauses} 次`} text="第二段开头停顿较长，可先在心中形成完整短句。" tone="orange" />
            <InsightCard icon={SquareActivity} title={`口头语 ${result.fillers} 次`} text="“然后”和“就是”重复较多，可以用安静停顿替代。" tone="gold" />
            <InsightCard icon={Target} title="结构完成度良好" text="观点明确；结尾增加一句回扣题目会更完整。" tone="blue" />
          </div>
          {transcript && <div className="mt-4 rounded-2xl bg-[#f3f7f5] p-4"><p className="text-xs font-semibold">语音转写</p><p className="mt-2 max-h-24 overflow-auto text-xs leading-5 text-muted-foreground">{transcript}</p></div>}
        </div>
        <div className="grid gap-5 md:grid-cols-[1fr_auto]">
          <div className="rounded-[22px] border border-border bg-[#fffaf3] p-5"><div className="flex items-center gap-2"><Music2 className="size-4 text-[#a6601c]" /><p className="text-sm font-semibold">演讲配乐预览</p></div><div className="mt-4 flex flex-wrap gap-2">{['温暖叙事','坚定励志','沉静思考'].map((mode) => <button key={mode} onClick={() => onMusicMode(mode)} className={`rounded-full px-3 py-1.5 text-xs ${musicMode === mode ? 'bg-[#173037] text-white' : 'bg-white text-muted-foreground'}`}>{mode}</button>)}</div><Button onClick={onToggleMusic} variant="outline" className="mt-4 rounded-xl"><Headphones />{musicPlaying ? '停止预览' : '预览配乐'}</Button></div>
          <div className="flex min-w-[190px] flex-col justify-center gap-3 rounded-[22px] border border-border bg-white p-5"><Button onClick={onRetry} className="h-11 rounded-xl bg-[#ef6248] text-white hover:bg-[#dc553d]"><RefreshCw />再次训练</Button><Button variant="outline" className="h-10 rounded-xl"><Download />保存报告</Button></div>
        </div>
      </div>
    </div>
  );
}

function InsightCard({ icon: Icon, title, text, tone }: { icon: typeof Activity; title: string; text: string; tone: 'teal' | 'orange' | 'gold' | 'blue' }) {
  const colors = { teal: 'bg-[#e8f4f1] text-[#267269]', orange: 'bg-[#fff0ec] text-[#d95740]', gold: 'bg-[#fff5dd] text-[#a6721e]', blue: 'bg-[#edf1f8] text-[#50688f]' };
  return <div className="rounded-2xl border border-border p-4"><div className={`grid size-8 place-items-center rounded-xl ${colors[tone]}`}><Icon className="size-4" /></div><p className="mt-3 text-sm font-semibold">{title}</p><p className="mt-1.5 text-xs leading-5 text-muted-foreground">{text}</p></div>;
}

function GrowthView() {
  const history = [62, 68, 71, 77, 82, 86];
  return (
    <div className="view-content"><PageHeading eyebrow="GROWTH PROFILE" title="每一次开口，都留下成长证据" description="将训练结果按时间沉淀，观察发音、流畅度和结构表达的变化。" /><div className="growth-grid grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
      <div className="glass-card rounded-[34px] border border-border bg-white p-6 md:p-8"><div className="flex items-center justify-between"><div><p className="font-semibold">近6次综合表现</p><p className="mt-1 text-xs text-muted-foreground">稳定上升 · 最近一次 86 分</p></div><Badge className="bg-[#e8f4f1] text-[#267269]">提升 24 分</Badge></div><div className="mt-8 flex h-56 items-end gap-4 border-b border-border px-2">{history.map((value,index) => <div key={value} className="flex flex-1 flex-col items-center gap-2"><span className="text-xs font-semibold">{value}</span><div className="growth-bar w-full max-w-12 rounded-t-xl bg-[#2f8177]" style={{ height: `${value * 1.8}px`, opacity: .45 + index * .1, animationDelay: `${index * 90}ms` }} /><span className="text-[10px] text-muted-foreground">第{index + 1}次</span></div>)}</div></div>
      <div className="space-y-5"><div className="score-card rounded-[34px] bg-[#173037] p-7 text-white"><Trophy className="size-6 text-[#f4bd68]" /><p className="mt-5 text-5xl font-semibold">18</p><p className="mt-1 text-sm text-white/58">累计训练次数</p><div className="my-5 h-px bg-white/10" /><p className="text-sm">本月最明显进步</p><p className="mt-2 text-xl font-semibold">口头语减少 41%</p></div><div className="glass-card rounded-[28px] border border-border bg-[#fffaf3] p-6"><p className="text-sm font-semibold">下一阶段目标</p><p className="mt-2 text-xs leading-5 text-muted-foreground">连续三次将语速保持在每分钟160—190字，并减少无意义停顿。</p></div></div>
    </div></div>
  );
}

function TeacherView() {
  return (
    <div className="view-content"><PageHeading eyebrow="TEACHER DASHBOARD" title="把个别纠音，变成可跟踪的教学反馈" description="教师查看班级共性问题、学生进步和待干预对象，AI建议可由教师复核。" action={<Button className="h-11 self-start rounded-full bg-[#3f7774] px-5 text-white sm:self-auto"><Download />导出班级报告</Button>} />
      <div className="teacher-stats grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{teacherStats.map(([Icon,value,label], index) => <div key={label} className={`rounded-[28px] border border-border p-5 ${index === 0 ? 'featured-stat' : 'glass-card bg-white'}`}><div className="flex items-center justify-between"><Icon className="size-5 text-[#2f8177]" /><span className="text-[11px] text-muted-foreground">较上周 ↑</span></div><p className="mt-5 text-4xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}</div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]"><div className="overflow-hidden rounded-[24px] border border-border bg-white"><div className="flex items-center justify-between border-b border-border p-5"><div><p className="font-semibold">学生训练概览</p><p className="mt-1 text-xs text-muted-foreground">按最近一次训练结果排序</p></div><Button variant="outline" size="sm">查看全部</Button></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-[#f3f7f5] text-xs text-muted-foreground"><tr>{['学生','本周训练','最近得分','进步','重点建议'].map((head) => <th key={head} className="px-5 py-3 font-medium">{head}</th>)}</tr></thead><tbody>{teacherRows.map((row) => <tr key={row[0]} className="border-t border-border"><td className="px-5 py-4 font-medium">{row[0]}</td><td className="px-5 py-4">{row[1]}</td><td className="px-5 py-4 font-semibold">{row[2]}</td><td className="px-5 py-4 text-[#267269]">{row[3]}</td><td className="px-5 py-4"><Badge variant="secondary">{row[4]}</Badge></td></tr>)}</tbody></table></div></div>
        <div className="rounded-[24px] border border-border bg-white p-5"><div className="flex items-center gap-2"><Volume2 className="size-5 text-[#ef6248]" /><p className="font-semibold">班级共性问题</p></div><div className="mt-6 space-y-5">{[['前后鼻音混淆',68],['语速偏快',54],['无意义口头语',47],['结尾缺少收束',39]].map(([label,value]) => <div key={label as string}><div className="mb-2 flex justify-between text-xs"><span>{label}</span><span className="text-muted-foreground">{value}%</span></div><Progress value={value as number} className="[&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-indicator]]:bg-[#ef6248]" /></div>)}</div><div className="mt-6 rounded-2xl bg-[#fffaf3] p-4"><p className="text-xs font-semibold">教学建议</p><p className="mt-2 text-xs leading-5 text-muted-foreground">下次课堂可安排“an/ang、en/eng”最小对立词专项练习，并抽取三名学生进行前后对比。</p></div></div>
      </div>
    </div>
  );
}
