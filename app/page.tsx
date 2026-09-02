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
type FeatureId = 'pronunciation' | 'speech' | 'analysis' | 'music' | 'growth' | 'teacher';

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
const pronunciationTokens = [
  ['语', 'yǔ'], ['言', 'yán'], ['是', 'shì'], ['思', 'sī'], ['想', 'xiǎng'], ['的', 'de'], ['声', 'shēng'], ['音', 'yīn'],
  ['清', 'qīng'], ['晰', 'xī'], ['准', 'zhǔn'], ['确', 'què'], ['表', 'biǎo'], ['达', 'dá'],
];
const waveform = [24, 41, 64, 38, 76, 52, 86, 46, 68, 32, 58, 78, 44, 64, 28, 49, 72, 36, 57, 31, 66, 43];
const teacherRows = [
  ['林晓雨', '5次', '86', '+12', '前后鼻音'],
  ['周子涵', '4次', '82', '+9', '语速偏快'],
  ['陈一诺', '3次', '79', '+7', '平翘舌'],
  ['王嘉言', '5次', '88', '+14', '结构完整度'],
  ['许知远', '3次', '77', '+6', '无意义停顿'],
  ['韩思齐', '4次', '84', '+10', '结尾收束'],
];

const teacherStats: Array<[typeof Users, string, string]> = [
  [Users, '32', '本周参与学生'],
  [Mic2, '126', '完成训练'],
  [BarChart3, '81.4', '班级平均分'],
  [Activity, '+9.6', '平均提升'],
];

const featureEntries: Array<{ id: FeatureId; label: string; eyebrow: string; description: string; icon: typeof Mic2 }> = [
  { id: 'pronunciation', label: '普通话纠音', eyebrow: 'PRONUNCIATION', description: '跟读、发音与停顿反馈', icon: AudioLines },
  { id: 'speech', label: '即兴演讲', eyebrow: 'IMPROMPTU', description: '题目、倒计时与结构提示', icon: Mic2 },
  { id: 'analysis', label: '录音分析', eyebrow: 'ANALYSIS', description: '语速、口头语与表达诊断', icon: BarChart3 },
  { id: 'music', label: '演讲配乐', eyebrow: 'SOUNDTRACK', description: '三种情绪氛围即时试听', icon: Music2 },
  { id: 'growth', label: '成长档案', eyebrow: 'GROWTH', description: '连续训练与能力变化', icon: Trophy },
  { id: 'teacher', label: '教师看板', eyebrow: 'TEACHER', description: '班级共性问题与教学反馈', icon: Users },
];

const navItems: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'today', label: '首页', icon: LayoutDashboard },
  { id: 'pronunciation', label: '普通话纠音', icon: AudioLines },
  { id: 'speech', label: '即兴演讲', icon: Mic2 },
  { id: 'growth', label: '成长档案', icon: Trophy },
  { id: 'teacher', label: '教师看板', icon: Users },
];

const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export default function Home() {
  const [view, setView] = useState<View>('today');
  const [feature, setFeature] = useState<FeatureId | null>(null);
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
  const analysisTimerRef = useRef<number | null>(null);

  const isPronunciation = view !== 'speech';
  const activeTopic = topics[topicIndex];

  useEffect(() => {
    const readFeature = () => {
      const requested = new URLSearchParams(window.location.search).get('feature') as FeatureId | null;
      setFeature(featureEntries.some((entry) => entry.id === requested) ? requested : null);
    };
    readFeature();
    window.addEventListener('popstate', readFeature);
    return () => window.removeEventListener('popstate', readFeature);
  }, []);

  useEffect(() => {
    const excludedCards = '.profile-features button, .analysis-preview, .music-records button';
    const moveHighlight = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest('button') as HTMLButtonElement | null;
      if (!button || button.matches(excludedCards)) return;
      const rect = button.getBoundingClientRect();
      button.style.setProperty('--liquid-x', `${event.clientX - rect.left}px`);
      button.style.setProperty('--liquid-y', `${event.clientY - rect.top}px`);
      button.style.setProperty('--liquid-active', '1');
    };
    const clearHighlight = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest('button') as HTMLButtonElement | null;
      if (!button || button.matches(excludedCards) || (event.relatedTarget instanceof Node && button.contains(event.relatedTarget))) return;
      button.style.setProperty('--liquid-active', '0');
    };
    document.addEventListener('pointermove', moveHighlight, { passive: true });
    document.addEventListener('pointerout', clearHighlight, { passive: true });
    return () => {
      document.removeEventListener('pointermove', moveHighlight);
      document.removeEventListener('pointerout', clearHighlight);
    };
  }, []);

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
    if (analysisTimerRef.current) window.clearTimeout(analysisTimerRef.current);
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
    if (analysisTimerRef.current) window.clearTimeout(analysisTimerRef.current);
    analysisTimerRef.current = null;
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
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recognitionRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setPhase('analyzing');
    analysisTimerRef.current = window.setTimeout(() => {
      setPhase('result');
      analysisTimerRef.current = null;
    }, 1400);
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

  function goTo(id: string, nextView?: View) {
    if (nextView) chooseView(nextView);
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 20);
  }

  function openFeature(id: FeatureId) {
    if (id === 'pronunciation' || id === 'speech') chooseView(id);
    window.history.pushState({ feature: id }, '', `${window.location.pathname}?feature=${id}`);
    setFeature(id);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function closeFeature() {
    if (phase === 'recording') stopRecording();
    resetTraining('today');
    window.history.replaceState({}, '', window.location.pathname);
    setFeature(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  if (feature) {
    const entry = featureEntries.find((item) => item.id === feature)!;
    return (
      <FeatureExperience entry={entry} onBack={closeFeature}>
        {(feature === 'pronunciation' || feature === 'speech') && (
          <TrainingView
            view={feature}
            phase={phase}
            topic={activeTopic}
            isPronunciation={feature === 'pronunciation'}
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
        {feature === 'analysis' && (
          <AnalysisStudio
            phase={phase}
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
            onStartRecording={() => void startRecording()}
            onStopRecording={stopRecording}
            onRetry={retryTraining}
          />
        )}
        {feature === 'music' && <MusicStudio musicMode={musicMode} musicPlaying={musicPlaying} onMusicMode={setMusicMode} onToggleMusic={toggleMusic} />}
        {feature === 'growth' && <GrowthView />}
        {feature === 'teacher' && <TeacherView />}
      </FeatureExperience>
    );
  }

  return (
    <main className="portfolio-site min-h-screen text-foreground">
      <header className="portfolio-topbar">
        <button className="brand-mark" onClick={() => goTo('home', 'today')} aria-label="返回首页">
          <span className="brand-icon"><AudioLines className="size-5" /></span>
          <span><strong>声动课堂</strong><small>VOICE LAB · 2026</small></span>
        </button>
        <div className="topbar-meta"><span className="status-dot" />系统已就绪</div>
        <button className="profile-pill" onClick={() => openFeature('growth')} aria-label="查看成长档案"><span>连续训练 4 天</span><CircleUserRound className="size-5" /></button>
      </header>

      <section className="hero-wrap" id="home">
        <div className="hero-frame">
          <video className="hero-loop" autoPlay muted loop playsInline poster="./shinchan-hero.jpg" aria-hidden="true">
            <source src="./shinchan-speech-loop.mp4" type="video/mp4" />
          </video>
          <div className="hero-art" aria-hidden="true"><span className="hero-orbit orbit-one" /><span className="hero-orbit orbit-two" /><AudioLines /></div>
          <div className="hero-copy">
            <p>AI SPEECH TRAINING · 2026</p>
            <h1>让每一次开口，<br />都更有力量。</h1>
            <span>普通话纠音 × 即兴演讲 × 录音诊断<br />为真实《演讲与口才》课堂而设计</span>
            <div className="hero-actions"><Button onClick={() => openFeature('pronunciation')} className="hero-primary"><Mic2 />开始一次训练</Button><button onClick={() => goTo('story')} className="hero-link">了解作品 <span>↘</span></button></div>
          </div>
          <div className="hero-stamp"><b>06</b><span>核心<br />学习场景</span></div>
        </div>

        <div className="floating-nav-wrap portfolio-nav-wrap">
          <nav className="floating-nav" aria-label="主要功能">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => id === 'today' ? goTo('home') : openFeature(id as FeatureId)} className={id === 'today' ? 'active' : ''}>
                <Icon className="size-[17px]" /><span>{label}</span>
              </button>
            ))}
            <button onClick={() => openFeature('analysis')}><BarChart3 className="size-[17px]" /><span>录音分析</span></button>
          </nav>
        </div>
      </section>

      <section className="character-profile" id="story">
        <div className="profile-kicker"><span>CHARACTER</span><strong>野原新之助</strong><small>5岁 / 春日部 / 表达训练搭档</small></div>
        <div className="profile-prop"><span>ITEM</span><strong>话筒</strong><small>把每次开口变成一次舞台。</small></div>
        {/* Static export keeps this single responsive artwork as a plain image. */}
        {/* oxlint-disable-next-line next/no-img-element */}
        <img className="profile-character" src="./shinchan-hero.jpg" alt="蜡笔小新手持话筒进行演讲训练" />
        <div className="profile-copy"><p>表达搭档</p><h2>小新陪你<br />大胆开口</h2><span>不怕说错，先敢于表达；再通过录音、纠音和复盘，让每一次练习都有迹可循。</span></div>
        <div className="profile-features" aria-label="六项学习功能">
          {featureEntries.map(({ id, label, eyebrow, description, icon: Icon }, index) => (
            <button key={id} onClick={() => openFeature(id)} style={{ '--card-index': index } as CSSProperties}>
              <Icon />
              <span>{eyebrow}</span>
              <strong>{label}</strong>
              <small>{description}</small>
            </button>
          ))}
        </div>
        <div className="profile-name">SHIN-CHAN</div>
      </section>

      <div className="highlights-title" aria-hidden="true"><span>SELECTED PROJECTS</span><strong>Highlights</strong></div>

      <section className="showcase-section light-scene" id="pronunciation">
        <div className="scene-heading"><span>01 / PRONUNCIATION</span><h2>听见每一个音<br />哪里需要更准确</h2><p>跟读标准文本，系统记录语速、停顿与发音表现，给出可再次练习的具体建议。</p></div>
        <div className="scene-card pronunciation-visual" aria-label="蜡笔小新与伙伴插画">
          <button className="pronunciation-enter" onClick={() => openFeature('pronunciation')}>进入专项训练 ↗</button>
        </div>
      </section>

      <section className="showcase-section dark-scene" id="speech">
        <div className="speech-stage" aria-label="蜡笔小新与伙伴插画">
          <button className="speech-enter" onClick={() => openFeature('speech')}>进入即兴训练 ↗</button>
        </div>
      </section>

      <section className="showcase-section analysis-scene" id="analysis">
        <div className="scene-heading"><span>03 / RECORDING ANALYSIS</span><h2>一次录音<br />不只得到一个分数</h2><p>把语速、停顿、口头语和表达结构拆成可理解、可行动的课堂反馈。</p></div>
        <button className="analysis-preview" onClick={() => openFeature('analysis')}><div className="score-hero"><span>综合表现</span><strong>{result.overall}</strong><small>点击进入录音诊断</small></div><div className="analysis-lines">{[['发音清晰度',result.clarity],['表达流畅度',result.fluency],['结构完整度',result.structure]].map(([label,value]) => <MetricBar key={label as string} label={label as string} value={value as number} color="#f1ad3f" />)}<div className="music-inline"><Music2 /><div><b>演讲配乐</b><span>{musicMode}</span></div><span className="analysis-enter">进入功能 ↗</span></div></div></button>
      </section>

      <SpotlightEnding onEnter={() => openFeature('pronunciation')} />

      <footer className="portfolio-footer sakura-ending">
        <div className="sakura-ending-art" aria-hidden="true" />
        <div className="sakura-ending-shade" aria-hidden="true" />
        <div className="sakura-ending-content">
          <p>准备好让声音<br />成为你的力量了吗？</p>
          <button onClick={() => openFeature('pronunciation')}><Mic2 />开始训练</button>
        </div>
        <div className="sakura-ending-meta"><span>声动课堂 · AI辅助演讲与口才训练</span><span>真实训练 · 教师复核 · 持续成长</span></div>
      </footer>
    </main>
  );
}

function FeatureExperience({ entry, onBack, children }: { entry: (typeof featureEntries)[number]; onBack: () => void; children: React.ReactNode }) {
  const Icon = entry.icon;
  return (
    <main className={`feature-page feature-${entry.id}`}>
      <header className="feature-topbar"><button onClick={onBack}>← 返回首页</button><span>声动课堂 · 独立功能空间</span></header>
      <section className="feature-cover">
        <FeatureHeroVisual id={entry.id} />
        <div className="feature-glass-title"><Icon /><small>{entry.eyebrow} / SPEECH LAB</small><h1>{entry.label}</h1><p>{entry.description}</p><span>向下进入功能 ↓</span></div>
      </section>
      <section className="feature-workspace">{children}</section>
      <footer className="feature-footer"><button onClick={onBack}>返回全部功能</button><span>VOICE LAB · 2026</span></footer>
    </main>
  );
}

function FeatureHeroVisual({ id }: { id: FeatureId }) {
  if (id === 'pronunciation') return <div className="feature-visual pronunciation-lab" aria-hidden="true"><div className="lab-grid" /><div className="syllable-track">{['zh','ch','sh','r'].map((sound) => <span key={sound}>{sound}</span>)}</div><div className="lab-wave">{waveform.map((height,index) => <i key={`${height}-${index}`} style={{ height: `${height + 18}%` }} />)}</div><AudioLines className="lab-core" /></div>;
  if (id === 'speech') return <div className="feature-visual speech-theatre" aria-hidden="true"><div className="curtain curtain-left" /><div className="curtain curtain-right" /><div className="theatre-beam" /><div className="topic-lottery"><small>随机题目</small><strong>如果声音有颜色</strong><span>PREP · 60</span></div><Mic2 className="theatre-mic" /></div>;
  if (id === 'analysis') return <div className="feature-visual analysis-dashboard" aria-hidden="true"><div className="dash-score"><small>VOICE SCORE</small><strong>86</strong></div><div className="dash-bars">{[62,84,71,92,78,88,69,95].map((value,index) => <i key={`${value}-${index}`} style={{ height: `${value}%` }} />)}</div><div className="dash-timeline">{Array.from({ length: 18 },(_,index) => <span key={index} />)}</div></div>;
  if (id === 'music') return <div className="feature-visual music-room" aria-hidden="true"><div className="turntable"><i /><span /></div><div className="music-notes"><Music2 /><span>WARM STORY</span></div><div className="equalizer">{[28,62,44,82,58,92,36,70].map((value,index) => <i key={`${value}-${index}`} style={{ height: `${value}%` }} />)}</div></div>;
  if (id === 'growth') return <div className="feature-visual growth-path" aria-hidden="true"><div className="path-line" />{[0,1,2,3,4].map((index) => <span className={`path-node node-${index}`} key={index}>{index === 4 ? <Trophy /> : index + 1}</span>)}<div className="growth-badge"><Sparkles /><strong>连续 4 天</strong></div></div>;
  return <div className="feature-visual teacher-console" aria-hidden="true"><div className="console-stats"><span><b>32</b>学生</span><span><b>126</b>训练</span><span><b>81.4</b>均分</span></div><div className="student-matrix">{Array.from({ length: 30 },(_,index) => <i key={index} className={index % 7 === 0 || index % 11 === 0 ? 'focus' : ''} />)}</div><div className="console-scan" /></div>;
}

function MusicStudio({ musicMode, musicPlaying, onMusicMode, onToggleMusic }: { musicMode: string; musicPlaying: boolean; onMusicMode: (mode: string) => void; onToggleMusic: () => void }) {
  return (
    <div className="music-studio">
      <div><span>SOUNDTRACK STUDIO</span><h2>给演讲加上一层<br />恰到好处的情绪</h2><p>选择表达氛围并即时试听。正式展示时，可以让音乐成为语气的衬托，而不是喧宾夺主。</p></div>
      <div className="music-records">
        {['温暖叙事','坚定励志','沉静思考'].map((mode, index) => <button key={mode} onClick={() => onMusicMode(mode)} className={musicMode === mode ? 'active' : ''}><i style={{ '--record-index': index } as CSSProperties} /><strong>{mode}</strong><span>{index === 0 ? '故事与回忆' : index === 1 ? '观点与倡议' : '反思与独白'}</span></button>)}
      </div>
      <Button onClick={onToggleMusic} className="music-play"><Headphones />{musicPlaying ? '停止试听' : `试听「${musicMode}」`}</Button>
    </div>
  );
}

function AnalysisStudio(props: {
  phase: Phase;
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
  onStartRecording: () => void;
  onStopRecording: () => void;
  onRetry: () => void;
}) {
  if (props.phase === 'result') {
    return <ResultView result={props.result} transcript={props.transcript} audioUrl={props.audioUrl} attempt={props.attempt} musicMode={props.musicMode} musicPlaying={props.musicPlaying} onMusicMode={props.onMusicMode} onToggleMusic={props.onToggleMusic} onRetry={props.onRetry} />;
  }
  return (
    <div className="view-content analysis-capture">
      <PageHeading eyebrow="RECORDING ANALYSIS" title="录一段真实表达，再看具体问题" description="录音结束后，系统从语速、停顿、清晰度、口头语和结构五个维度生成诊断。AI结果用于训练提示，最终判断由教师复核。" />
      <article className="training-card">
        <div className="training-card-top"><Badge>自由表达采样</Badge><span>建议 30–90 秒</span></div>
        <div className="training-card-body">
          <h2>请围绕“我最近学会的一件事”自然讲述一段话。</h2>
          <p>不需要背稿，尽量保留真实语速和停顿，诊断结果会更有参考价值。</p>
          <Recorder phase={props.phase} seconds={props.seconds} transcript={props.transcript} error={props.micError} isPronunciation={false} onPrepare={props.onStartRecording} onRecord={props.onStartRecording} onStop={props.onStopRecording} />
        </div>
      </article>
    </div>
  );
}

function SpotlightEnding({ onEnter }: { onEnter: () => void }) {
  function moveSpotlight(event: React.PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
  }
  return (
    <section className="spotlight-ending" onPointerMove={moveSpotlight}>
      <div className="spotlight-dark" />
      <div className="spotlight-reveal" />
      <div className="spotlight-copy"><small>THE VOICE INSIDE</small><h2>声音的秘密<br />藏在每一次练习里</h2><p>移动光标，照亮小新的表达舞台。</p><button onClick={onEnter}>进入训练 ↗</button></div>
      <div className="cursor-hint">移动光标 · 哪里亮起来</div>
    </section>
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
    <div className={`view-content training-view ${isPronunciation ? 'pronunciation-training' : 'speech-training'}`}>
      <PageHeading eyebrow={eyebrow} title={title} description={isPronunciation ? '跟读标准文本，获得字词、语速、停顿和流畅度分析。' : '从真实话题出发，完成准备、表达、诊断和二次改进。'} action={!isPronunciation ? <Button onClick={props.onShuffle} variant="outline" className="h-10 self-start rounded-xl px-4 sm:self-auto"><Shuffle /> 换一个训练题</Button> : undefined} />

      {phase !== 'result' ? (
        <div className={`training-grid ${isPronunciation ? 'phonetic-training-grid' : 'stage-training-grid'}`}>
          <article className={`training-card ${isPronunciation ? 'phonetic-training-card' : 'stage-training-card'}`}>
            <div className="training-card-top">
              <div className="flex items-center gap-2.5"><Badge className="bg-[#12262b] px-2.5">{isPronunciation ? '专项朗读' : '即兴演讲'}</Badge><span className="text-xs text-muted-foreground">第 {attempt} 次训练</span></div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{isPronunciation ? '建议朗读 30 秒' : '准备 60 秒 · 演讲 2 分钟'}</div>
            </div>
            <div className="training-card-body">
              <div className="flex items-start gap-4"><div className="hidden size-11 shrink-0 place-items-center rounded-2xl bg-[#fff0ec] text-[#e85d44] sm:grid"><BookOpenText className="size-5" /></div><div><p className="text-xs font-medium text-muted-foreground">{isPronunciation ? '朗读文本' : '今日题目'}</p><h2 className="mt-2 max-w-3xl text-xl font-semibold leading-relaxed md:text-[26px]">{isPronunciation ? readingText : topic.title}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{isPronunciation ? '请自然朗读，不必刻意放慢；系统将重点关注前后鼻音、平翘舌和停顿。' : topic.cue}</p></div></div>
              {isPronunciation ? (
                <div className="phonetic-strip" aria-label="逐字拼音标注">
                  <div className="phonetic-strip-head"><span>逐字标音</span><small>声调 · 音节 · 发音位置</small></div>
                  <div className="phonetic-token-row">{pronunciationTokens.map(([character, pinyin], index) => <span key={`${character}-${index}`}><small>{pinyin}</small><strong>{character}</strong></span>)}</div>
                  <div className="phonetic-focus"><b>本轮重点</b><span>zh / ch / sh</span><span>an / ang</span><span>en / eng</span></div>
                </div>
              ) : (
                <div className="speech-prep-panel">
                  <div className={`countdown-orbit ${phase === 'preparing' ? 'is-running' : ''}`}><small>PREP</small><strong>{phase === 'preparing' ? seconds : '60'}</strong><span>秒</span></div>
                  <div className="speech-structure-track"><span><b>01</b>观点先行</span><i /><span><b>02</b>具体例证</span><i /><span><b>03</b>回扣题目</span></div>
                </div>
              )}
              <Recorder phase={phase} seconds={seconds} transcript={transcript} error={micError} isPronunciation={isPronunciation} onPrepare={props.onStartPreparation} onRecord={props.onStartRecording} onStop={props.onStopRecording} />
            </div>
          </article>
          <aside className="side-stack">{isPronunciation ? <PronunciationFocus /> : <SpeechStructure />}<TipCard isPronunciation={isPronunciation} /></aside>
        </div>
      ) : (
        <ResultView result={result} transcript={transcript} audioUrl={audioUrl} attempt={attempt} musicMode={props.musicMode} musicPlaying={props.musicPlaying} onMusicMode={props.onMusicMode} onToggleMusic={props.onToggleMusic} onRetry={props.onRetry} />
      )}
    </div>
  );
}

function PronunciationFocus() {
  return (
    <div className="pronunciation-focus-card"><span>VOICE POSITION</span><h3>口腔发音定位</h3><div>{[['zh','舌尖后'],['sh','摩擦音'],['ang','后鼻韵']].map(([sound,label]) => <p key={sound}><b>{sound}</b><small>{label}</small></p>)}</div><em>跟着标音逐字朗读，错误音节会在诊断后单独列出。</em></div>
  );
}

function SpeechStructure() {
  return (
    <div className="speech-structure-card"><span>STAGE CUE</span><h3>两分钟表达节奏</h3><div><p><b>00:00</b>亮观点</p><p><b>00:30</b>讲例子</p><p><b>01:30</b>做收束</p></div><em>倒计时只提示节奏，不打断演讲。</em></div>
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

function TipCard({ isPronunciation }: { isPronunciation: boolean }) {
  return (
    <div className="flex w-full items-center gap-4 rounded-[22px] border border-border bg-[#fffaf3] p-5"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#ffe9d2] text-[#a6601c]"><Lightbulb className="size-5" /></div><div><p className="text-sm font-semibold">{isPronunciation ? '朗读小提示' : '表达结构提示'}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{isPronunciation ? '先看完整句意，再按语义自然停顿。' : '观点先行，用一个具体例子支撑，结尾回扣题目。'}</p></div></div>
  );
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return <div><div className="mb-2 flex items-center justify-between text-xs"><span>{label}</span><span className="font-semibold tabular-nums">{value}</span></div><Progress value={value} className="[&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-indicator]]:bg-[var(--bar-color)]" style={{ '--bar-color': color } as CSSProperties} /></div>;
}

function ResultView({ result, transcript, audioUrl, attempt, musicMode, musicPlaying, onMusicMode, onToggleMusic, onRetry }: { result: { overall: number; clarity: number; fluency: number; structure: number; speed: number; pauses: number; fillers: number }; transcript: string; audioUrl: string; attempt: number; musicMode: string; musicPlaying: boolean; onMusicMode: (mode: string) => void; onToggleMusic: () => void; onRetry: () => void }) {
  function saveReport() {
    const report = [`声动课堂 · 第 ${attempt} 次训练报告`,`综合表现：${result.overall}`,`清晰度：${result.clarity}`,`流畅度：${result.fluency}`,`完整度：${result.structure}`,`语速：${result.speed} 字/分钟`,`不当停顿：${result.pauses} 次`,`口头语：${result.fillers} 次`,transcript ? `转写：${transcript}` : '转写：当前浏览器未提供语音转写'].join('\n');
    const href = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = `声动课堂-训练报告-${attempt}.txt`;
    link.click();
    URL.revokeObjectURL(href);
  }
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
          <div className="flex min-w-[190px] flex-col justify-center gap-3 rounded-[22px] border border-border bg-white p-5"><Button onClick={onRetry} className="h-11 rounded-xl bg-[#ef6248] text-white hover:bg-[#dc553d]"><RefreshCw />再次训练</Button><Button onClick={saveReport} variant="outline" className="h-10 rounded-xl"><Download />保存报告</Button></div>
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
  const [showAll, setShowAll] = useState(false);
  function exportClassReport() {
    const header = ['学生','本周训练','最近得分','进步','重点建议'];
    const csv = [header,...teacherRows].map((row) => row.join(',')).join('\n');
    const href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = '声动课堂-班级训练报告.csv';
    link.click();
    URL.revokeObjectURL(href);
  }
  return (
    <div className="view-content"><PageHeading eyebrow="TEACHER DASHBOARD" title="把个别纠音，变成可跟踪的教学反馈" description="教师查看班级共性问题、学生进步和待干预对象，AI建议可由教师复核。" action={<Button onClick={exportClassReport} className="h-11 self-start rounded-full bg-[#3f7774] px-5 text-white sm:self-auto"><Download />导出班级报告</Button>} />
      <div className="teacher-stats grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{teacherStats.map(([Icon,value,label], index) => <div key={label} className={`rounded-[28px] border border-border p-5 ${index === 0 ? 'featured-stat' : 'glass-card bg-white'}`}><div className="flex items-center justify-between"><Icon className="size-5 text-[#2f8177]" /><span className="text-[11px] text-muted-foreground">较上周 ↑</span></div><p className="mt-5 text-4xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}</div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]"><div className="overflow-hidden rounded-[24px] border border-border bg-white"><div className="flex items-center justify-between border-b border-border p-5"><div><p className="font-semibold">学生训练概览</p><p className="mt-1 text-xs text-muted-foreground">按最近一次训练结果排序</p></div><Button onClick={() => setShowAll((current) => !current)} variant="outline" size="sm">{showAll ? '收起' : '查看全部'}</Button></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-[#f3f7f5] text-xs text-muted-foreground"><tr>{['学生','本周训练','最近得分','进步','重点建议'].map((head) => <th key={head} className="px-5 py-3 font-medium">{head}</th>)}</tr></thead><tbody>{teacherRows.slice(0, showAll ? teacherRows.length : 4).map((row) => <tr key={row[0]} className="border-t border-border"><td className="px-5 py-4 font-medium">{row[0]}</td><td className="px-5 py-4">{row[1]}</td><td className="px-5 py-4 font-semibold">{row[2]}</td><td className="px-5 py-4 text-[#267269]">{row[3]}</td><td className="px-5 py-4"><Badge variant="secondary">{row[4]}</Badge></td></tr>)}</tbody></table></div></div>
        <div className="rounded-[24px] border border-border bg-white p-5"><div className="flex items-center gap-2"><Volume2 className="size-5 text-[#ef6248]" /><p className="font-semibold">班级共性问题</p></div><div className="mt-6 space-y-5">{[['前后鼻音混淆',68],['语速偏快',54],['无意义口头语',47],['结尾缺少收束',39]].map(([label,value]) => <div key={label as string}><div className="mb-2 flex justify-between text-xs"><span>{label}</span><span className="text-muted-foreground">{value}%</span></div><Progress value={value as number} className="[&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-indicator]]:bg-[#ef6248]" /></div>)}</div><div className="mt-6 rounded-2xl bg-[#fffaf3] p-4"><p className="text-xs font-semibold">教学建议</p><p className="mt-2 text-xs leading-5 text-muted-foreground">下次课堂可安排“an/ang、en/eng”最小对立词专项练习，并抽取三名学生进行前后对比。</p></div></div>
      </div>
    </div>
  );
}
