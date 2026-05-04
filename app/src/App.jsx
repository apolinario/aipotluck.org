import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

  const syncViewportHeight = () => {
    const h = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${Math.round(h)}px`);
  };

  const snapSectionIntoView = (idx, instant) => {
    const target = sectionRefs.current[idx];
    if (!target) return;
    target.scrollIntoView({
      behavior: instant ? 'auto' : 'smooth',
      block: 'start',
      inline: 'nearest',
    });
  };

  /** Distance from scroll container origin to section top — offsetTop breaks when offsetParent ≠ container. */
  const sectionScrollTop = (container, el) =>
    Math.round(
      el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop,
    );

  const scrollToSection = (idx, opts = {}) => {
    snapSectionIntoView(idx, !!opts.instant);
  };

  const pageScrollStep = () => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : window.innerHeight;
  };

  const scrollByPage = (dir) => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollBy({ top: dir * pageScrollStep(), behavior: 'smooth' });
  };

  useLayoutEffect(() => {
    syncViewportHeight();
    snapSectionIntoView(2, true);
  }, []);

  useEffect(() => {
    syncViewportHeight();
    const resyncHome = () => {
      syncViewportHeight();
      snapSectionIntoView(2, true);
    };
    window.addEventListener('resize', syncViewportHeight);
    window.visualViewport?.addEventListener('resize', syncViewportHeight);
    const onPageShow = (e) => {
      if (e.persisted) resyncHome();
    };
    window.addEventListener('pageshow', onPageShow);
    let onLoad = null;
    if (document.readyState === 'complete') {
      resyncHome();
    } else {
      onLoad = () => resyncHome();
      window.addEventListener('load', onLoad);
    }
    return () => {
      window.removeEventListener('resize', syncViewportHeight);
      window.visualViewport?.removeEventListener('resize', syncViewportHeight);
      window.removeEventListener('pageshow', onPageShow);
      if (onLoad) window.removeEventListener('load', onLoad);
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
    <div
      style={{
        width: '100vw',
        height: 'var(--app-height)',
        maxHeight: 'var(--app-height)',
        overflow: 'hidden',
        background: '#020508',
      }}
    >
      <div ref={scrollRef} className="scroll-container" style={{ width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
        <div ref={(el) => (sectionRefs.current[0] = el)} style={{ height: 'var(--app-height)' }}>
          <EcosystemSection mode={mode} />
        </div>
        <div ref={(el) => (sectionRefs.current[1] = el)} style={{ isolation: 'isolate' }}>
          <RoadmapSection mode={mode} />
        </div>
        <div
          ref={(el) => (sectionRefs.current[2] = el)}
          style={{
            height: 'var(--app-height)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <HomeHero mode={mode} />
        </div>
        <div ref={(el) => (sectionRefs.current[3] = el)} style={{ height: 'var(--app-height)' }}>
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
