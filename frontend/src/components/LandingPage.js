import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const LandingPage = ({ onGetStarted }) => {
  const [currentImage, setCurrentImage] = useState(0);

  const images = [
    { id: 'img1', url: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', thumb: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80', alt: 'Blood Analysis' },
    { id: 'img2', url: 'https://images.unsplash.com/photo-1551601651-2a8555f1a136?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', thumb: 'https://images.unsplash.com/photo-1551601651-2a8555f1a136?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80', alt: 'Laboratory' },
    { id: 'img3', url: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', thumb: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80', alt: 'Medical Report' },
    { id: 'img4', url: 'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', thumb: 'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80', alt: 'Health Dashboard' }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 2000); // Changed to 2 seconds
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
    <>
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <i className="fas fa-heartbeat text-2xl text-[#8B0000]"></i>
            <h1 className="text-2xl font-bold text-[#8B0000]">Health Monitoring Hub</h1>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#home" onClick={(e) => handleSmoothScroll(e, '#home')} className="text-sm font-medium text-[#8B0000] hover:text-[#DC143C] transition-colors">Home</a>
            <a href="#features" onClick={(e) => handleSmoothScroll(e, '#features')} className="text-sm font-medium text-[#8B0000] hover:text-[#DC143C] transition-colors">Features</a>
            <a href="#steps" onClick={(e) => handleSmoothScroll(e, '#steps')} className="text-sm font-medium text-[#8B0000] hover:text-[#DC143C] transition-colors">How It Works</a>
            <a href="#contact" onClick={(e) => handleSmoothScroll(e, '#contact')} className="text-sm font-medium text-[#8B0000] hover:text-[#DC143C] transition-colors">Contact</a>
          </nav>
          <Button onClick={() => onGetStarted && onGetStarted()} className="bg-[#8B0000] hover:bg-[#B22222] shadow-lg shadow-[#8B0000]/30">Try Free Analysis</Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32 bg-gradient-to-r from-white to-[#FFE4E1]" id="home">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                Understand Your <span className="text-[#8B0000]">Blood Test Results</span> in Simple Terms
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl">
                Upload your CBC report and get clear, easy-to-understand insights powered by AI technology. No medical jargon, just simple explanations.
              </p>
              <div className="flex gap-4">
                <Button size="lg" onClick={() => onGetStarted && onGetStarted()} className="bg-[#8B0000] hover:bg-[#B22222]">Start Free Analysis</Button>
              </div>
            </div>
            <div className="flex-1 relative h-[500px] w-full">
              {images.map((img, index) => (
                <div 
                  key={img.id} 
                  className={`absolute inset-0 bg-cover bg-center rounded-lg transition-opacity duration-500 ${currentImage === index ? 'opacity-100' : 'opacity-0'}`}
                  style={{ backgroundImage: `url(${img.url})` }}
                ></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-[#fafafa]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">Why Choose Health Monitoring Hub</h3>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">We transform complex medical reports into simple, actionable insights</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-[0_20px_50px_rgba(220,20,60,0.3)] hover:scale-105 transition-all duration-300 cursor-pointer shadow-lg shadow-[#DC143C]/20">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-[#FFE4E1] flex items-center justify-center mb-4 transition-transform duration-300 hover:scale-110">
                  <i className="fas fa-brain text-2xl text-[#8B0000]"></i>
                </div>
                <CardTitle className="text-[#8B0000]">Smart AI Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Our AI reads your blood report just like a doctor would, but explains everything in plain language you can understand.</CardDescription>
              </CardContent>
            </Card>
            <Card className="hover:shadow-[0_20px_50px_rgba(220,20,60,0.3)] hover:scale-105 transition-all duration-300 cursor-pointer shadow-lg shadow-[#DC143C]/20">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-[#FFE4E1] flex items-center justify-center mb-4 transition-transform duration-300 hover:scale-110">
                  <i className="fas fa-bell text-2xl text-[#8B0000]"></i>
                </div>
                <CardTitle className="text-[#8B0000]">Early Warning System</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Get alerted about potential health issues so you can take action early, before they become serious problems.</CardDescription>
              </CardContent>
            </Card>
            <Card className="hover:shadow-[0_20px_50px_rgba(220,20,60,0.3)] hover:scale-105 transition-all duration-300 cursor-pointer shadow-lg shadow-[#DC143C]/20">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-[#FFE4E1] flex items-center justify-center mb-4 transition-transform duration-300 hover:scale-110">
                  <i className="fas fa-chart-line text-2xl text-[#8B0000]"></i>
                </div>
                <CardTitle className="text-[#8B0000]">Track Your Health Journey</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>See how your health numbers change over time with beautiful, easy-to-read charts that show your progress.</CardDescription>
              </CardContent>
            </Card>
            <Card className="hover:shadow-[0_20px_50px_rgba(220,20,60,0.3)] hover:scale-105 transition-all duration-300 cursor-pointer shadow-lg shadow-[#DC143C]/20">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-[#FFE4E1] flex items-center justify-center mb-4 transition-transform duration-300 hover:scale-110">
                  <i className="fas fa-apple-alt text-2xl text-[#8B0000]"></i>
                </div>
                <CardTitle className="text-[#8B0000]">Personalized Health Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Get diet, exercise, and lifestyle suggestions tailored specifically to your blood test results.</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-20 bg-white" id="steps">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 relative inline-block">
              How to Use Health Monitoring Hub
              <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-20 h-1 bg-[#8B0000] rounded"></span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mt-6">Follow these simple steps to get insights from your blood test reports</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8B0000] to-[#B22222] text-white flex items-center justify-center text-2xl font-bold mb-6 shadow-lg shadow-[#DC143C]/40 hover:shadow-[0_20px_50px_rgba(220,20,60,0.5)] hover:scale-110 transition-all duration-300 cursor-pointer">
                1
              </div>
              <h3 className="text-xl font-semibold mb-3 text-[#8B0000]">Upload Your Report</h3>
              <p className="text-muted-foreground">Upload a clear image or PDF of your CBC blood test report. Our OCR technology will extract all the values automatically, or you can enter them manually.</p>
            </div>
            
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8B0000] to-[#B22222] text-white flex items-center justify-center text-2xl font-bold mb-6 shadow-lg shadow-[#DC143C]/40 hover:shadow-[0_20px_50px_rgba(220,20,60,0.5)] hover:scale-110 transition-all duration-300 cursor-pointer">
                2
              </div>
              <h3 className="text-xl font-semibold mb-3 text-[#8B0000]">AI Analysis & Detection</h3>
              <p className="text-muted-foreground">Our ML models analyze your results, compare them against reference ranges, flag abnormalities, and classify potential health conditions.</p>
            </div>
            
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8B0000] to-[#B22222] text-white flex items-center justify-center text-2xl font-bold mb-6 shadow-lg shadow-[#DC143C]/40 hover:shadow-[0_20px_50px_rgba(220,20,60,0.5)] hover:scale-110 transition-all duration-300 cursor-pointer">
                3
              </div>
              <h3 className="text-xl font-semibold mb-3 text-[#8B0000]">Get Personalized Insights</h3>
              <p className="text-muted-foreground">Receive clear explanations of your results, severity classifications (normal/mild/critical), and personalized lifestyle & dietary recommendations.</p>
            </div>
            
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8B0000] to-[#B22222] text-white flex items-center justify-center text-2xl font-bold mb-6 shadow-lg shadow-[#DC143C]/40 hover:shadow-[0_20px_50px_rgba(220,20,60,0.5)] hover:scale-110 transition-all duration-300 cursor-pointer">
                4
              </div>
              <h3 className="text-xl font-semibold mb-3 text-[#8B0000]">Track & Monitor</h3>
              <p className="text-muted-foreground">Store your reports in your personal health dashboard. Visualize trends over time with interactive graphs to monitor your health journey.</p>
            </div>
          </div>
        </div>
      </section>

      {/* More Features */}
      <section className="py-20 bg-gradient-to-br from-[#fff8f8] to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">Built with Patients in Mind</h3>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Designed to make health monitoring simple and accessible for everyone</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-[0_20px_50px_rgba(220,20,60,0.3)] hover:scale-105 transition-all duration-300 cursor-pointer shadow-lg shadow-[#DC143C]/20">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-[#FFE4E1] flex items-center justify-center mb-4 transition-transform duration-300 hover:scale-110">
                  <i className="fas fa-lock text-2xl text-[#8B0000]"></i>
                </div>
                <CardTitle className="text-[#8B0000]">Your Data is Safe</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Your health information is protected and private. We keep it safe and secure.</CardDescription>
              </CardContent>
            </Card>
            <Card className="hover:shadow-[0_20px_50px_rgba(220,20,60,0.3)] hover:scale-105 transition-all duration-300 cursor-pointer shadow-lg shadow-[#DC143C]/20">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-[#FFE4E1] flex items-center justify-center mb-4 transition-transform duration-300 hover:scale-110">
                  <i className="fas fa-comment-medical text-2xl text-[#8B0000]"></i>
                </div>
                <CardTitle className="text-[#8B0000]">No Medical Jargon</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>We explain everything in simple, everyday language. No confusing terms.</CardDescription>
              </CardContent>
            </Card>
            <Card className="hover:shadow-[0_20px_50px_rgba(220,20,60,0.3)] hover:scale-105 transition-all duration-300 cursor-pointer shadow-lg shadow-[#DC143C]/20">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-[#FFE4E1] flex items-center justify-center mb-4 transition-transform duration-300 hover:scale-110">
                  <i className="fas fa-mobile-alt text-2xl text-[#8B0000]"></i>
                </div>
                <CardTitle className="text-[#8B0000]">Works Everywhere</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Access your health dashboard from your phone, tablet, or computer anytime.</CardDescription>
              </CardContent>
            </Card>
            <Card className="hover:shadow-[0_20px_50px_rgba(220,20,60,0.3)] hover:scale-105 transition-all duration-300 cursor-pointer shadow-lg shadow-[#DC143C]/20">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-[#FFE4E1] flex items-center justify-center mb-4 transition-transform duration-300 hover:scale-110">
                  <i className="fas fa-user-md text-2xl text-[#8B0000]"></i>
                </div>
                <CardTitle className="text-[#8B0000]">Doctor-Friendly</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Share easy-to-read reports with your doctor for better discussions about your health.</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-[#333333] text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <div>
              <h3 className="text-xl font-semibold mb-4 pb-2 border-b-2 border-[#DC143C] w-fit">Health Monitoring Hub</h3>
              <p className="text-gray-300 mb-2">A Final Year Design Project by Software Engineering students at University of the Punjab, Lahore.</p>
              <p className="text-gray-300 mb-4">Transforming complex blood test reports into understandable health insights using AI and Machine Learning.</p>
              <div className="flex items-center gap-2 text-gray-300 text-sm">
                <i className="fas fa-university"></i>
                <span>Faculty of Computing & Information Technology, University of the Punjab</span>
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-4 pb-2 border-b-2 border-[#DC143C] w-fit">Quick Links</h3>
              <div className="flex flex-col gap-2">
                <a href="#home" onClick={(e) => handleSmoothScroll(e, '#home')} className="text-gray-300 hover:text-[#DC143C] transition-colors">Home</a>
                <a href="#features" onClick={(e) => handleSmoothScroll(e, '#features')} className="text-gray-300 hover:text-[#DC143C] transition-colors">Features</a>
                <a href="#steps" onClick={(e) => handleSmoothScroll(e, '#steps')} className="text-gray-300 hover:text-[#DC143C] transition-colors">How It Works</a>
                <a href="#contact" onClick={(e) => handleSmoothScroll(e, '#contact')} className="text-gray-300 hover:text-[#DC143C] transition-colors">Contact</a>
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-4 pb-2 border-b-2 border-[#DC143C] w-fit">Project Team</h3>
              <div className="flex flex-col gap-2 text-gray-300 text-sm">
                <p><i className="fas fa-user-graduate mr-2"></i> Madiha Sadaqat - BSEF22M518</p>
                <p><i className="fas fa-user-graduate mr-2"></i> Hafsa Akhtar - BSEF22M530</p>
                <p><i className="fas fa-user-graduate mr-2"></i> Hooria Laiba - BSEF22M536</p>
                <p><i className="fas fa-user-graduate mr-2"></i> Ukasha Zia - BSEF22M537</p>
                <p><i className="fas fa-chalkboard-teacher mr-2"></i> Supervisor: Dr. Mudassira Arshad</p>
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-4 pb-2 border-b-2 border-[#DC143C] w-fit">Contact Information</h3>
              <div className="flex flex-col gap-2 text-gray-300 text-sm mb-4">
                <p><i className="fas fa-envelope mr-2"></i> fydp.dse@pucit.edu.pk</p>
                <p><i className="fas fa-globe mr-2"></i> http://www.pucit.edu.pk</p>
                <p><i className="fas fa-map-marker-alt mr-2"></i> Faculty of Computing & Information Technology, University of the Punjab, Lahore, Pakistan</p>
              </div>
              <div className="flex gap-3">
                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#8B0000] transition-colors">
                  <i className="fab fa-facebook-f"></i>
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#8B0000] transition-colors">
                  <i className="fab fa-twitter"></i>
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#8B0000] transition-colors">
                  <i className="fab fa-linkedin-in"></i>
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#8B0000] transition-colors">
                  <i className="fab fa-github"></i>
                </a>
              </div>
            </div>
          </div>
          
          <div className="text-center pt-8 border-t border-white/10 text-gray-400 text-sm">
            <p>&copy; 2024 Health Monitoring Hub - FYDP Group ID: FPSEF25X63. All rights reserved.</p>
            <p className="mt-2">This platform is for educational purposes and should not replace professional medical advice.</p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default LandingPage;
