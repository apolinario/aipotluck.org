import { useEffect, useRef, useState } from 'react';
import { EcosystemSection } from './components/EcosystemSection.jsx';
import { RoadmapSection } from './components/RoadmapSection.jsx';
import { HomeHero } from './components/HomeHero.jsx';
import { StorySection } from './components/StorySection.jsx';
import { MissionSection } from './components/MissionSection.jsx';
import { NavOverlay } from './components/NavOverlay.jsx';
import { SectionDots } from './components/SectionDots.jsx';
import { Chevron } from './components/Chevron.jsx';

export default function App() {
  const [section, setSection] = useState(2);
  const [mode, setMode] = useState('dawn');
  const [atTop, setAtTop] = useState(false);
  const [atBot, setAtBot] = useState(false);
  const scrollRef = useRef(null);
  const sectionRefs = useRef([]);

  /** Distance from scroll container origin to section top — offsetTop breaks when offsetParent ≠ container. */
  const sectionScrollTop = (container, el) =>
    Math.round(
      el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop,
    );

  const scrollToSection = (idx, opts = {}) => {
    const container = scrollRef.current;
    const target = sectionRefs.current[idx];
    if (!container || !target) return;
    const top = sectionScrollTop(container, target);
    const behavior = opts.instant ? 'auto' : 'smooth';
    container.scrollTo({ top: Math.max(0, top), behavior });
  };

  const scrollByPage = (dir) => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollBy({ top: dir * window.innerHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    let cancelled = false;
    /** Run after roadmap layout settles (sticky bg + imgs); offsetTop timing was undershooting mobile. */
    const run = () => {
      if (cancelled) return;
      scrollToSection(2, { instant: true });
    };
    const t = setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(run)), 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onScroll = () => {
      const st = container.scrollTop;
      const ch = container.clientHeight;
      const sh = container.scrollHeight;
      setAtTop(st < 8);
      setAtBot(st + ch >= sh - 8);
      let active = 0;
      const threshold = st + ch * 0.45;
      sectionRefs.current.forEach((ref, i) => {
        if (!ref) return;
        if (sectionScrollTop(container, ref) <= threshold) active = i;
      });
      setSection(active);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#020508' }}>
      <div ref={scrollRef} className="scroll-container" style={{ width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
        <div ref={(el) => (sectionRefs.current[0] = el)} style={{ height: '100vh' }}>
          <EcosystemSection mode={mode} />
        </div>
        <div ref={(el) => (sectionRefs.current[1] = el)}>
          <RoadmapSection mode={mode} />
        </div>
        <div ref={(el) => (sectionRefs.current[2] = el)} style={{ height: '100vh' }}>
          <HomeHero mode={mode} />
        </div>
        <div ref={(el) => (sectionRefs.current[3] = el)} style={{ height: '100vh' }}>
          <StorySection mode={mode} />
        </div>
        <div ref={(el) => (sectionRefs.current[4] = el)}>
          <MissionSection />
        </div>
      </div>

      <NavOverlay mode={mode} setMode={setMode} section={section} setSection={scrollToSection} />
      <SectionDots section={section} setSection={scrollToSection} />
      {!atTop && <Chevron dir="up" onClick={() => scrollByPage(-1)} />}
      {!atBot && <Chevron dir="down" onClick={() => scrollByPage(1)} />}
    </div>
  );
}
