import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
// In LandingPage.js - add this import
import { useNavigate } from 'react-router-dom';

const LandingPage = ({ onGetStarted }) => {
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [currentImage, setCurrentImage] = useState(0);

  const images = [
    
    {
  id: 'img2',
  url: 'https://cdn.britannica.com/32/191732-050-5320356D/Human-red-blood-cells.jpg',
  alt: 'Human Red Blood Cells'
},
    {
  id: 'img3',
  url: 'https://s3-us-west-2.amazonaws.com/courses-images/wp-content/uploads/sites/1223/2017/02/08203641/Figure_40_02_01-1024x533.jpg',
  alt: 'Blood Cell Structure Diagram'
},
    {
  id: 'img4',
  url: 'https://news.harvard.edu/wp-content/uploads/2015/10/red_blood_cells_605.jpg',
  alt: 'Red Blood Cells Harvard Image'
},
	{
  id: 'img1',
  url: 'https://ourbloodinstitute.org/site/assets/files/13576/artificial_blood_cropped.jpg',
  alt: 'Artificial Blood Substitute'
}
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [images.length]);

  const handleSmoothScroll = (e, targetId) => {
    e.preventDefault();
    const element = document.querySelector(targetId);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh' }}>
      {/* Global styles as inline style tag */}
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

       
		 body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          /* Slightly deeper at the top so the hero + slider sit on consistent pink (no harsh “white band”) */
          background: linear-gradient(180deg, 
            #ffe0e0 0%,
            #ffcccc 12%,
            #ffb3b3 24%,
            #ff9999 36%,
            #ff8080 48%,
            #e06666 58%,
            #cc4d4d 68%,
            #b33b3b 78%,
            #992929 88%,
            #801515 100%
          );
          background-attachment: fixed;
          min-height: 100vh;
          color: #1e1a1a;
        }

        .glass-card {
          background: rgba(255, 250, 250, 0.88);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(200, 70, 70, 0.5);
          border-radius: 2rem;
          box-shadow: 0 18px 35px -12px rgba(140, 20, 20, 0.25);
          transition: all 0.3s ease;
        }

        .glass-card:hover {
          background: rgba(255, 245, 245, 0.96);
          border-color: #c0392b;
          transform: translateY(-6px);
          box-shadow: 0 25px 40px -12px rgba(160, 30, 30, 0.35);
        }

        .step-number {
          background: linear-gradient(135deg, #c0392b, #911e1e);
          box-shadow: 0 12px 18px rgba(170, 40, 40, 0.3);
          color: white;
        }

        .navbar-blur {
          background: rgba(255, 245, 245, 0.85);
          backdrop-filter: blur(18px);
          border-bottom: 1px solid rgba(190, 70, 70, 0.4);
        }

        /* Slider frame: solid tint only — backdrop-blur + padding caused pale seams next to photos on mobile */
        .hero-slider-frame {
          background: linear-gradient(145deg, #f5d0d0 0%, #e8a8a8 100%);
          border: 2px solid rgba(160, 45, 45, 0.45);
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
        }

        html {
          scroll-behavior: smooth;
        }

        @media (max-width: 768px) {
          body {
            background-attachment: scroll !important;
          }
        }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-50 w-full navbar-blur transition-all duration-300">
        <div className="container flex h-16 items-center justify-between gap-2 px-4 md:px-8 mx-auto max-w-full">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 md:flex-none">
            <i className="fas fa-heartbeat text-2xl sm:text-3xl text-[#c0392b] shrink-0"></i>
            <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight text-[#2c1212] truncate" style={{ fontFamily: "'Playfair Display', serif" }}>
              Health Monitoring Hub
            </h1>
          </div>
          <nav className="hidden md:flex items-center gap-7 shrink-0">
            <a href="#home" onClick={(e) => handleSmoothScroll(e, '#home')} className="text-[#571f1f] font-medium hover:text-[#b13a3a] transition-colors">Home</a>
            <a href="#features" onClick={(e) => handleSmoothScroll(e, '#features')} className="text-[#571f1f] font-medium hover:text-[#b13a3a] transition-colors">Features</a>
            <a href="#steps" onClick={(e) => handleSmoothScroll(e, '#steps')} className="text-[#571f1f] font-medium hover:text-[#b13a3a] transition-colors">How It Works</a>
            <a href="#contact" onClick={(e) => handleSmoothScroll(e, '#contact')} className="text-[#571f1f] font-medium hover:text-[#b13a3a] transition-colors">Contact</a>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-300/60 bg-white/70 text-[#8B0000] hover:bg-red-50"
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              <i className={`fas ${mobileNavOpen ? 'fa-times' : 'fa-bars'} text-lg`}></i>
            </button>
            <Button
              onClick={() => {
                setMobileNavOpen(false);
                if (onGetStarted) onGetStarted();
                else navigate('/login');
              }}
              className="bg-gradient-to-r from-[#c0392b] to-[#941e1e] hover:from-[#d94a3a] hover:to-[#ad2a2a] text-white font-semibold px-3 py-2 sm:px-6 text-xs sm:text-sm rounded-full shadow-lg shadow-red-800/30 whitespace-nowrap"
            >
              <span className="sm:hidden">Try free</span>
              <span className="hidden sm:inline">Try Free Analysis</span>
            </Button>
          </div>
        </div>
        {mobileNavOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              aria-label="Close menu"
              onClick={() => setMobileNavOpen(false)}
            />
            <nav className="relative z-50 border-t border-red-200/50 bg-[#fff8f8]/95 px-4 py-4 md:hidden flex flex-col gap-3 shadow-inner">
              <a href="#home" onClick={(e) => { setMobileNavOpen(false); handleSmoothScroll(e, '#home'); }} className="text-[#571f1f] font-medium py-2 border-b border-red-100/80">Home</a>
              <a href="#features" onClick={(e) => { setMobileNavOpen(false); handleSmoothScroll(e, '#features'); }} className="text-[#571f1f] font-medium py-2 border-b border-red-100/80">Features</a>
              <a href="#steps" onClick={(e) => { setMobileNavOpen(false); handleSmoothScroll(e, '#steps'); }} className="text-[#571f1f] font-medium py-2 border-b border-red-100/80">How It Works</a>
              <a href="#contact" onClick={(e) => { setMobileNavOpen(false); handleSmoothScroll(e, '#contact'); }} className="text-[#571f1f] font-medium py-2">Contact</a>
            </nav>
          </>
        )}
      </header>

      {/* Hero Section — no overflow-hidden: it clipped scaled image layers and showed seams on narrow viewports */}
      <section id="home" className="relative py-14 sm:py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center gap-6 md:gap-10 lg:gap-12">
            <div className="flex-1 space-y-5 sm:space-y-7 w-full min-w-0">
              <div className="inline-block px-4 py-1 rounded-full bg-white/60 backdrop-blur-sm text-[#a1352a] text-sm font-semibold border border-red-300/60 shadow-sm">
                <i className="fas fa-microchip mr-2"></i> AI-Powered Health Intelligence
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold leading-tight text-[#241010] text-balance break-words" style={{ textShadow: '0 1px 2px rgba(255,255,200,0.2)' }}>
                Understand Your <span className="text-[#c53a2b] border-b-4 border-red-400 inline-block pb-1">Blood Test Results</span><br/> in Simple Terms
              </h2>
              <p className="text-lg text-[#4e2a2a] max-w-xl leading-relaxed font-medium">
                Upload your CBC report and get clear, easy-to-understand insights powered by AI. No medical jargon, just clarity & control.
              </p>
              <div className="flex gap-5 pt-2 flex-wrap">
                <Button size="lg" onClick={() => onGetStarted && onGetStarted()} className="bg-gradient-to-r from-[#c0392b] to-[#8f2020] hover:from-[#dc4a3a] hover:to-[#a52828] text-white font-semibold px-8 py-3 rounded-full shadow-xl text-lg">
                   Start Free Analysis
                </Button>
                <a href="#features" onClick={(e) => handleSmoothScroll(e, '#features')} className="border border-red-400/70 text-[#ac3a2a] bg-white/30 hover:bg-red-100/50 rounded-full px-6 py-3 font-medium transition-all backdrop-blur-sm flex items-center gap-2">
                  Explore <i className="fas fa-arrow-right text-sm"></i>
                </a>
              </div>
            </div>
            <div className="flex-1 relative w-full min-w-0 h-[280px] sm:h-[360px] md:h-[520px]">
              <div className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl hero-slider-frame">
                {images.map((img, idx) => (
                  <img
                    key={img.id}
                    src={img.url}
                    alt={img.alt}
                    className={`absolute inset-0 h-full w-full object-cover object-center pointer-events-none transition-opacity duration-700 ease-in-out ${
                      currentImage === idx ? 'opacity-100 z-[1]' : 'opacity-0 z-0'
                    }`}
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    draggable={false}
                  />
                ))}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 z-[2] pointer-events-auto">
                  {images.map((_, idx) => (
                    <button 
                      type="button"
                      key={idx} 
                      onClick={() => setCurrentImage(idx)} 
                      className={`h-2.5 rounded-full transition-all shadow-sm ${currentImage === idx ? 'bg-red-800 w-6' : 'bg-white/85 w-2.5 hover:bg-white'}`}
                      aria-label={`Show slide ${idx + 1}`}
                    ></button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-4xl md:text-5xl font-bold text-[#2b1111] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
              Why Choose <span className="text-[#b54234]">Health Monitoring Hub</span>
            </h3>
            <p className="text-[#562d2d] text-lg max-w-2xl mx-auto font-medium">Transforming complex reports into actionable health insights</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: 'fa-brain', title: 'Smart AI Analysis', desc: 'Our AI reads your blood report just like a doctor would, but explains everything in plain language you can understand.' },
              { icon: 'fa-bell', title: 'Early Warning System', desc: 'Get alerted about potential health issues so you can take action early, before they become serious.' },
              { icon: 'fa-chart-line', title: 'Track Your Health Journey', desc: 'See how your health numbers change over time with beautiful, easy-to-read charts.' },
              { icon: 'fa-apple-alt', title: 'Personalized Health Tips', desc: 'Get diet, exercise, and lifestyle suggestions tailored to your blood test results.' }
            ].map((feat, i) => (
              <Card key={i} className="glass-card hover:shadow-2xl hover:shadow-red-300/30 transition-all duration-300">
                <CardHeader>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-md bg-gradient-to-br from-[#c54232] to-[#8f2424]">
                    <i className={`fas ${feat.icon} text-2xl text-white`}></i>
                  </div>
                  <CardTitle className="text-[#2f1414]">{feat.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-[#5c2c2c]">{feat.desc}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section id="steps" className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[#2b1111] inline-block relative" style={{ fontFamily: "'Playfair Display', serif" }}>
              How to Use <span className="text-[#b54234]">Health Monitoring Hub</span>
              <span className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-red-500 rounded-full"></span>
            </h2>
            <p className="text-[#562d2d] text-lg max-w-2xl mx-auto mt-6 font-medium">Four simple steps, one healthier you</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-7">
            {[
              { num: '01', title: 'Upload Report', desc: 'Upload a clear image or PDF of your CBC report. Our OCR extracts values automatically or you can enter manually.' },
              { num: '02', title: 'AI Analysis', desc: 'Our ML models analyze results, compare with reference ranges, flag abnormalities, and classify conditions.' },
              { num: '03', title: 'Personalized Insights', desc: 'Receive clear explanations, severity classifications, and personalized lifestyle recommendations.' },
              { num: '04', title: 'Track & Monitor', desc: 'Store reports in your dashboard. Visualize trends over time with interactive graphs.' }
            ].map((step, idx) => (
              <div key={idx} className="glass-card p-6 group hover:translate-y-[-10px] transition-all duration-300">
                <div className="step-number w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black text-white mb-5">{step.num}</div>
                <h3 className="text-2xl font-bold text-[#2b1111] mb-3">{step.title}</h3>
                <p className="text-[#5f3131] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* More Features - Doctor-Friendly card removed, now 3 cards */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-4xl md:text-5xl font-bold text-[#2b1111]" style={{ fontFamily: "'Playfair Display', serif" }}>Built with <span className="text-[#b54234]">Patients in Mind</span></h3>
            <p className="text-[#562d2d] text-lg mt-3">Designed to make health monitoring simple and accessible for everyone</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { icon: 'fa-lock', title: 'Your Data is Safe', desc: 'Your health information is protected and private. We keep it safe and secure.' },
              { icon: 'fa-comment-medical', title: 'No Medical Jargon', desc: 'We explain everything in simple, everyday language. No confusing terms.' },
              { icon: 'fa-mobile-alt', title: 'Works Everywhere', desc: 'Access your health dashboard from any device, anytime.' }
            ].map((item, i) => (
              <Card key={i} className="glass-card group hover:scale-[1.02] transition-all duration-300">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 border border-red-300/60 shadow-md bg-gradient-to-br from-[#bd3e2e] to-[#982a2a]">
                    <i className={`fas ${item.icon} text-2xl text-white`}></i>
                  </div>
                  <CardTitle className="text-[#2f1414] text-xl">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-[#5c2c2c]">{item.desc}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="py-16 mt-10" style={{ borderTop: '1px solid rgba(180, 70, 70, 0.5)', background: 'rgba(250, 235, 235, 0.7)', backdropFilter: 'blur(10px)' }}>
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div>
              <h3 className="text-2xl font-bold mb-4 flex items-center gap-2 text-[#2b1111]">
                <i className="fas fa-heartbeat text-[#c0392b]"></i> Health Monitoring Hub
              </h3>
              <p className="text-[#572a2a] mb-3">A Final Year Design Project by Software Engineering students at University of the Punjab, Lahore.</p>
              <p className="text-[#572a2a]">Transforming complex blood test reports into understandable health insights using AI and Machine Learning.</p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-4 pb-2 border-b-2 border-red-500 w-fit text-[#2b1111]">Quick Links</h3>
              <div className="flex flex-col gap-2">
                <a href="#home" onClick={(e) => handleSmoothScroll(e, '#home')} className="text-[#a13e2e] hover:text-[#601f1f] transition">Home</a>
                <a href="#features" onClick={(e) => handleSmoothScroll(e, '#features')} className="text-[#a13e2e] hover:text-[#601f1f] transition">Features</a>
                <a href="#steps" onClick={(e) => handleSmoothScroll(e, '#steps')} className="text-[#a13e2e] hover:text-[#601f1f] transition">How It Works</a>
                <a href="#contact" onClick={(e) => handleSmoothScroll(e, '#contact')} className="text-[#a13e2e] hover:text-[#601f1f] transition">Contact</a>
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-4 pb-2 border-b-2 border-red-500 w-fit text-[#2b1111]">Project Team</h3>
              <div className="text-[#632e2e] text-sm space-y-1">
                <p><i className="fas fa-user-graduate mr-2 w-5 text-red-700"></i> Madiha Sadaqat - BSEF22M518</p>
                <p><i className="fas fa-user-graduate mr-2 w-5 text-red-700"></i> Hafsa Akhtar - BSEF22M530</p>
                <p><i className="fas fa-user-graduate mr-2 w-5 text-red-700"></i> Hooria Laiba - BSEF22M536</p>
                <p><i className="fas fa-user-graduate mr-2 w-5 text-red-700"></i> Ukasha Zia - BSEF22M537</p>
                <p><i className="fas fa-chalkboard-teacher mr-2 w-5 text-red-700"></i> Supervisor: Dr. Mudassira Arshad</p>
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-4 pb-2 border-b-2 border-red-500 w-fit text-[#2b1111]">Contact</h3>
              <div className="text-[#632e2e] text-sm space-y-2">
                <p><i className="fas fa-envelope mr-2 text-red-600"></i> fydp.dse@pucit.edu.pk</p>
                <p><i className="fas fa-globe mr-2 text-red-600"></i> www.pucit.edu.pk</p>
                <p><i className="fas fa-map-marker-alt mr-2 text-red-600"></i> FCIT, University of the Punjab, Lahore, Pakistan</p>
              </div>
              <div className="flex gap-3 mt-5">
                <a href="#" className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center hover:bg-red-200 transition-all text-red-800"><i className="fab fa-facebook-f"></i></a>
                <a href="#" className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center hover:bg-red-200 transition-all text-red-800"><i className="fab fa-twitter"></i></a>
                <a href="#" className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center hover:bg-red-200 transition-all text-red-800"><i className="fab fa-linkedin-in"></i></a>
                <a href="#" className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center hover:bg-red-200 transition-all text-red-800"><i className="fab fa-github"></i></a>
              </div>
            </div>
          </div>
          
          <div className="text-center pt-6 border-t border-red-300/50 text-[#623535] text-sm">
            <p>&copy; 2024 Health Monitoring Hub - FYDP Group ID: FPSEF25X63. All rights reserved.</p>
            <p className="mt-2">This platform is for educational purposes and should not replace professional medical advice.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;