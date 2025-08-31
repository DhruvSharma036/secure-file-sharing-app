import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

// --- API Configuration ---
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// --- Reusable Components ---

const AnimatedBackground = () => (
  <div className="fixed inset-0 -z-10 h-full w-full bg-slate-950">
    {/* FIX: Increased opacity of gradient blobs to make them more prominent */}
    <div className="absolute bottom-0 left-[-20%] right-0 top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(96,165,250,0.2),rgba(255,255,255,0))] animate-blob-one"></div>
    <div className="absolute bottom-0 right-[-20%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(96,165,250,0.2),rgba(255,255,255,0))] animate-blob-two"></div>
    <div className="absolute bottom-[-20%] left-[20%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(168,85,247,0.2),rgba(255,255,255,0))] animate-blob-three"></div>
    <div className="absolute bottom-[40%] right-[5%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(250,96,190,0.2),rgba(255,255,255,0))] animate-blob-four"></div>
  </div>
);

const Icon = ({ path, className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const MessageBox = ({ message, type, onDismiss }) => {
  if (!message) return null;
  const colors = {
    success: 'bg-green-900/30 border-green-600 text-green-200',
    error: 'bg-red-900/30 border-red-600 text-red-200',
    info: 'bg-blue-900/30 border-blue-600 text-blue-200',
  };
  return (
    <div className={`border px-4 py-3 rounded-lg relative ${colors[type] || colors.info}`} role="alert">
      <span className="block sm:inline">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="absolute top-0 bottom-0 right-0 px-4 py-3">
          <Icon path="M6 18L18 6M6 6l12 12" className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

const LoadingBar = () => (
  <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-4">
      <p className="text-slate-400">Initializing Secure Session...</p>
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-2 bg-sky-500 w-full animate-loading-bar"></div>
      </div>
  </div>
);

const Spinner = () => (
    <div className="flex justify-center items-center p-10">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div>
    </div>
);

const Footer = () => (
    <footer className="w-full text-center p-6 mt-auto bg-slate-900/50 backdrop-blur-sm border-t border-slate-800">
        <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} Secure Share. All Rights Reserved.
            <br />
            <a 
                href="https://www.linkedin.com/in/dhruv-sharma-468747285"
                target="_blank" 
                rel="noopener noreferrer"
                className="font-semibold text-sky-400 hover:text-sky-300 transition-colors"
            >
                Developed by Dhruv Sharma
            </a>
        </p>
    </footer>
);


function App() {
  const [page, setPage] = useState('upload');
  const [downloadFileId, setDownloadFileId] = useState(null);
  const [appIsLoading, setAppIsLoading] = useState(true);
  
  const [user, setUser] = useState(null); 
  const [authPage, setAuthPage] = useState('login');
  
  const [isMammothLoaded, setIsMammothLoaded] = useState(false);

  useEffect(() => {
    const scriptId = 'mammoth-script';
    if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.7.1/mammoth.browser.min.js";
        script.async = true;
        script.onload = () => setIsMammothLoaded(true);
        script.onerror = () => console.error("Mammoth.js script failed to load.");
        document.body.appendChild(script);
    } else if (window.mammoth) {
        setIsMammothLoaded(true);
    }

    const checkUserSession = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' });
            if (response.ok) {
                const userData = await response.json();
                setUser(userData);
            }
        } catch (error) {
            console.error("No active session");
        } finally {
            setTimeout(() => {
              const path = window.location.pathname;
              if (path.startsWith('/download/')) {
                const id = path.split('/download/')[1];
                setDownloadFileId(id);
                setPage('download');
              }
              setAppIsLoading(false);
            }, 750);
        }
    };
    checkUserSession();
    
  }, []);
  
  const handleLogout = async () => {
    if (user && !user.isGuest) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    }
    setUser(null);
    setPage('upload');
  };
  
  const handleGuestLogin = () => {
    const guestId = uuidv4();
    setUser({ isGuest: true, id: guestId });
  };

  const renderPage = () => {
    if (page === 'download') {
        return <DownloadPage fileId={downloadFileId} />;
    }
    if (!user) {
        return (
          <div className="flex-grow flex items-center justify-center">
            <AuthPage page={authPage} setPage={setAuthPage} onAuthSuccess={setUser} onGuestLogin={handleGuestLogin} />
          </div>
        );
    }
    switch (page) {
      case 'upload':
        return <UploadForm user={user} isMammothLoaded={isMammothLoaded} />;
      case 'dashboard':
        return <Dashboard user={user} />;
      default:
        return <UploadForm user={user} isMammothLoaded={isMammothLoaded} />;
    }
  };

  const NavButton = ({ targetPage, currentPage, setPage, iconPath, label }) => (
    <button
      onClick={() => setPage(targetPage)}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 ${
        currentPage === targetPage ? 'bg-sky-600 text-white shadow-lg' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
      }`}
    >
      <Icon path={iconPath} className="w-5 h-5" />
      {label}
    </button>
  );

  if (appIsLoading) {
    return (
      <>
        <style>{`
          @keyframes loading-bar-animation {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .animate-loading-bar {
            animation: loading-bar-animation 1.5s infinite linear;
          }
        `}</style>
        <AnimatedBackground />
        <div className="min-h-screen flex items-center justify-center">
          <LoadingBar />
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @keyframes blob-one-animation { 0% { transform: translate(0, 0) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0, 0) scale(1); } }
        @keyframes blob-two-animation { 0% { transform: translate(0, 0) scale(1); } 33% { transform: translate(-30px, 40px) scale(1.1); } 66% { transform: translate(20px, -20px) scale(0.9); } 100% { transform: translate(0, 0) scale(1); } }
        @keyframes blob-three-animation { 0% { transform: translate(0, 0) scale(1); } 33% { transform: translate(40px, 60px) scale(1.2); } 66% { transform: translate(-50px, -30px) scale(0.8); } 100% { transform: translate(0, 0) scale(1); } }
        @keyframes blob-four-animation { 0% { transform: translate(0, 0) scale(1); } 33% { transform: translate(-20px, -40px) scale(1.1); } 66% { transform: translate(30px, 50px) scale(1); } 100% { transform: translate(0, 0) scale(1); } }
        .animate-blob-one { animation: blob-one-animation 12s infinite ease-in-out; }
        .animate-blob-two { animation: blob-two-animation 12s infinite ease-in-out 3s; }
        .animate-blob-three { animation: blob-three-animation 16s infinite ease-in-out 5s; }
        .animate-blob-four { animation: blob-four-animation 14s infinite ease-in-out 7s; }
      `}</style>
      <AnimatedBackground />
      <div className="min-h-screen font-sans text-slate-200 relative z-10 flex flex-col">
        <div className="w-full bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
               <div className="flex items-center gap-3">
                 <div className="bg-sky-600 p-2 rounded-lg text-white shadow-md">
                    <Icon path="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m0-3l-3-3m0 0l-3 3m3-3v11.25" className="w-6 h-6"/>
                 </div>
                 <h1 className="text-xl font-bold text-white">Secure Share</h1>
               </div>
               {user && (
                 <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-300">
                        {user.isGuest ? "Guest Mode" : `Welcome, ${user.username}!`}
                    </span>
                    <button onClick={handleLogout} className="text-sm font-semibold text-slate-300 hover:text-sky-400 transition-colors">
                        {user.isGuest ? "Exit Guest Mode" : "Logout"}
                    </button>
                 </div>
               )}
            </div>
          </div>
        </div>
        
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow flex flex-col">
          {user && page !== 'download' && (
             <header className="max-w-md mx-auto mb-8 w-full">
                <nav className="bg-slate-800 p-2 rounded-xl shadow-md">
                    <div className="flex justify-around items-center gap-2">
                        <NavButton targetPage="upload" currentPage={page} setPage={setPage} iconPath="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" label="Upload" />
                        <NavButton targetPage="dashboard" currentPage={page} setPage={setPage} iconPath="M3.75 3v11.25A2.25 2.25 0 006 16.5h12A2.25 2.25 0 0020.25 14.25V3m-15.75 0h15.75M3.75 3A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25A2.25 2.25 0 0020.25 3H3.75z" label="Dashboard" />
                    </div>
                </nav>
            </header>
          )}
          <main className="flex-grow flex flex-col">
            {renderPage()}
          </main>
        </div>
        <Footer />
      </div>
    </>
  );
}

function AuthPage({ page, setPage, onAuthSuccess, onGuestLogin }) {
    return (
        <div className="w-full max-w-md mx-auto">
            <div className="bg-slate-800/50 p-8 rounded-2xl shadow-xl border border-slate-700">
                <div className="flex justify-center mb-6">
                    <button onClick={() => setPage('login')} className={`px-4 py-2 text-sm font-semibold rounded-l-lg transition-colors ${page === 'login' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Login</button>
                    <button onClick={() => setPage('register')} className={`px-4 py-2 text-sm font-semibold rounded-r-lg transition-colors ${page === 'register' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Register</button>
                </div>
                {page === 'login' ? <LoginForm onAuthSuccess={onAuthSuccess} /> : <RegisterForm onAuthSuccess={onAuthSuccess} />}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-slate-600" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-slate-800/50 px-2 text-sm text-slate-400">Or</span>
                  </div>
                </div>
                <div className="text-center">
                    <button onClick={onGuestLogin} className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500">
                        Continue as Guest
                    </button>
                </div>
            </div>
        </div>
    );
}

function LoginForm({ onAuthSuccess }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            onAuthSuccess(data);
        } catch (err) {
            setError(err.message || 'Login failed.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-xl font-bold text-center text-white">Welcome Back</h2>
            {error && <MessageBox message={error} type="error" onDismiss={() => setError('')} />}
            <div>
                <label className="block text-sm font-medium text-slate-300">Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" className="mt-1 block w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 placeholder:text-slate-400" required />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-300">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="mt-1 block w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 placeholder:text-slate-400" required />
            </div>
            <button type="submit" disabled={isLoading} className="w-full py-2 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50">
                {isLoading ? 'Logging in...' : 'Login'}
            </button>
        </form>
    );
}

function RegisterForm({ onAuthSuccess }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            onAuthSuccess(data);
        } catch (err) {
            setError(err.message || 'Registration failed.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <h2 className="text-xl font-bold text-center text-white">Create an Account</h2>
            {error && <MessageBox message={error} type="error" onDismiss={() => setError('')} />}
            <div>
                <label className="block text-sm font-medium text-slate-300">Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Choose a username" className="mt-1 block w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 placeholder:text-slate-400" required />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-300">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a strong password" className="mt-1 block w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 placeholder:text-slate-400" required />
            </div>
            <p className="text-xs text-slate-400">Must be 6+ characters with a number & special character.</p>
            <button type="submit" disabled={isLoading} className="w-full py-2 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50">
                {isLoading ? 'Registering...' : 'Register'}
            </button>
        </form>
    );
}

function UploadForm({ user, isMammothLoaded }) {
  const [file, setFile] = useState(null);
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [downloadLimit, setDownloadLimit] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const spinnerIcon = <Icon path="M21 12a9 9 0 11-6.219-8.56" className="animate-spin h-5 w-5" />;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setAnalysisResult(null); 
    setGeneratedLink('');
    if (selectedFile && selectedFile.size > 100 * 1024 * 1024) { 
        setError("File size cannot exceed 100MB."); 
        setFile(null); 
    } else { 
        setFile(selectedFile); 
        setError(''); 
    }
  };

  const handleDragEvents = (e, over) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(over); };
  const handleDrop = (e) => {
    handleDragEvents(e, false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) { handleFileChange({ target: { files: [droppedFile] }}); }
  };
  
  const handleAnalyze = () => {
    if (!file) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setError('');

    const performAnalysisRequest = async (content) => {
        if (!content) {
             setError("Could not extract text from the file for analysis.");
             setIsAnalyzing(false);
             return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/api/files/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });
            const result = await response.json();
            if (response.ok && result.success) {
                setAnalysisResult(result.analysis);
                if (result.analysis.pii_types && result.analysis.pii_types.length > 0) {
                    setIsModalOpen(true);
                } else {
                    setError('Analysis complete. No sensitive information found.');
                }
            } else {
                throw new Error(result.message || 'Analysis failed with AI.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const reader = new FileReader();
    const isDocx = file.name.toLowerCase().endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (isDocx) {
        if (!isMammothLoaded || !window.mammoth) {
            setError("The .docx analysis library is not ready. Please try again.");
            setIsAnalyzing(false);
            return;
        }
        reader.onload = (e) => {
            const arrayBuffer = e.target.result;
            window.mammoth.extractRawText({ arrayBuffer })
                .then(result => {
                    performAnalysisRequest(result.value);
                })
                .catch(err => {
                    setError("Could not read .docx file. It may be corrupted or password-protected.");
                    setIsAnalyzing(false);
                });
        };
        reader.onerror = () => {
            setError("Failed to read the .docx file from your device.");
            setIsAnalyzing(false);
        };
        reader.readAsArrayBuffer(file);
    } else { // Handle plain text files
        reader.onload = (e) => {
            performAnalysisRequest(e.target.result);
        };
        reader.onerror = () => {
            setError("Could not read the file. It might be corrupted.");
            setIsAnalyzing(false);
        };
        reader.readAsText(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setError('Please select a file to upload.'); return; }
    setError(''); setIsLoading(true); setGeneratedLink('');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('expiresInHours', expiresInHours);
    formData.append('downloadLimit', downloadLimit);
    formData.append('password', password);
    if (user.isGuest) { formData.append('userId', user.id); }

    try {
      const fetchOptions = { method: 'POST', body: formData };
      if (!user.isGuest) { fetchOptions.credentials = 'include'; }
      
      const response = await fetch(`${API_BASE_URL}/api/upload`, fetchOptions);
      const result = await response.json();
      
      if (response.ok && result.success) { 
          setGeneratedLink(result.link); 
          setFile(null);
      } else { 
          setError(result.message || 'File upload failed.'); 
      }
    } catch (err) {
      setError('Could not connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    }).catch(err => console.error('Failed to copy: ', err));
  };
  
  const isDocx = file && (file.name.toLowerCase().endsWith('.docx'));

  const isAnalyzableFile = file && (
    (file.type || '').startsWith('text/') || 
    (file.type || '').includes('json') || 
    ['.txt', '.json', '.log', '.docx'].some(ext => file.name.toLowerCase().endsWith(ext))
  );
  
  const isAnalyzeButtonDisabled = isAnalyzing || (isDocx && !isMammothLoaded);


  return (
    <>
    {isModalOpen && analysisResult && (
        <PrivacyWarningModal 
            piiTypes={analysisResult.pii_types} 
            onClose={() => setIsModalOpen(false)}
            onSecure={() => { 
                setIsModalOpen(false);
                setTimeout(() => document.getElementById('password')?.focus(), 100);
            }}
        />
    )}
    <div className="w-full max-w-2xl mx-auto bg-slate-800/50 p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-700">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="file-upload" className="block text-sm font-semibold text-slate-300 mb-2">Upload File</label>
          <div 
            onDragEnter={(e) => handleDragEvents(e, true)}
            onDragLeave={(e) => handleDragEvents(e, false)}
            onDragOver={(e) => handleDragEvents(e, true)}
            onDrop={handleDrop}
            className={`mt-1 flex justify-center px-6 pt-8 pb-8 border-2 border-slate-600 border-dashed rounded-xl transition-colors duration-200 ${isDragOver ? 'bg-sky-900/20 border-sky-500' : 'bg-slate-800/50'}`}>
            <div className="space-y-1 text-center">
              <Icon path="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" className="mx-auto h-12 w-12 text-slate-500" />
              <div className="flex text-sm text-slate-300">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-transparent rounded-md font-semibold text-sky-400 hover:text-sky-300 focus-within:outline-none">
                  <span>Choose a file</span>
                  <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-slate-400">{file ? `${file.name}` : 'Up to 100MB'}</p>
            </div>
          </div>
          {isAnalyzableFile && (
            <div className="mt-4">
                <button type="button" onClick={handleAnalyze} disabled={isAnalyzeButtonDisabled} className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-200 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isAnalyzing ? spinnerIcon : <Icon path="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" className="w-5 h-5"/>}
                    {isDocx && !isMammothLoaded ? 'Preparing for .docx...' : (isAnalyzing ? 'Analyzing...' : 'Analyze for Privacy Risks')}
                </button>
                {isDocx && !isMammothLoaded && <p className="text-xs text-slate-400 mt-1 text-center">Please wait, analysis engine is loading.</p>}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-xl bg-slate-700/50 p-4">
            <h3 className="font-semibold text-slate-200">Link Options</h3>
            <div>
              <label htmlFor="expires" className="block text-sm font-medium text-slate-300">Expires In</label>
              <select id="expires" value={expiresInHours} onChange={e => setExpiresInHours(e.target.value)} className="mt-1 appearance-none w-full pl-3 pr-8 py-2 bg-slate-900 border border-slate-600 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md shadow-sm cursor-pointer">
                <option value={1}>1 Hour</option>
                <option value={24}>24 Hours</option>
                <option value={72}>3 Days</option>
                <option value={168}>7 Days</option>
              </select>
            </div>
            <div>
              <label htmlFor="limit" className="block text-sm font-medium text-slate-300">Download Limit</label>
              <input type="number" id="limit" value={downloadLimit} onChange={e => setDownloadLimit(e.target.value)} placeholder="No limit" className="mt-1 bg-slate-900 focus:ring-sky-500 focus:border-sky-500 block w-full shadow-sm sm:text-sm border-slate-600 rounded-md" min="1"/>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">Password (Recommended)</label>
              <div className="relative mt-1">
                  <input type={showPassword ? 'text' : 'password'} id="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Optional" className="focus:ring-sky-500 focus:border-sky-500 bg-slate-900 block w-full shadow-sm sm:text-sm border-slate-600 rounded-md" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-slate-400">
                    <Icon path={showPassword ? "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L6.228 6.228" : "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z"} className="h-5 w-5" />
                  </button>
              </div>
            </div>
        </div>

        <button type="submit" disabled={isLoading || !file} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-base font-semibold text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:bg-slate-500 transition-all duration-200">
           {isLoading && <span className="mr-2">{spinnerIcon}</span>}
          {isLoading ? 'Uploading...' : 'Generate Secure Link'}
        </button>
      </form>
      
      {error && <div className="mt-4"><MessageBox message={error} type={error.includes('No sensitive') ? 'success' : 'error'} onDismiss={() => setError('')} /></div>}

      {generatedLink && (
        <div className="mt-6 p-4 bg-slate-700/50 rounded-xl border border-slate-700">
            <h3 className="text-lg font-semibold text-slate-200">Link Generated!</h3>
            <p className="text-sm text-slate-400 mb-3">Share this link to allow others to download your file.</p>
            <div className="mt-2 flex items-center gap-2 bg-slate-900 p-2 border border-slate-600 rounded-md shadow-sm">
                <input type="text" readOnly value={generatedLink} className="flex-grow p-1 border-none focus:ring-0 text-sm text-slate-300 bg-transparent" />
                <button 
                  onClick={() => copyToClipboard(generatedLink)} 
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors duration-200 w-20 text-center ${isCopied ? 'bg-green-500 text-white' : 'bg-slate-600 text-slate-200 hover:bg-slate-500'}`}
                >
                  {isCopied ? 'Copied!' : 'Copy'}
                </button>
            </div>
        </div>
      )}
    </div>
    </>
  );
}

function Dashboard({ user }) {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    setError('');
    let url = `${API_BASE_URL}/api/files`;
    if (user.isGuest) { url += `?userId=${user.id}`; }
    
    try {
        const fetchOptions = {};
        if (!user.isGuest) { fetchOptions.credentials = 'include'; }
        const response = await fetch(url, fetchOptions);
        if (!response.ok) { throw new Error('Failed to fetch files'); }
        const userFiles = await response.json();
        setFiles(userFiles);
    } catch (err) {
        console.error("Failed to fetch dashboard files", err);
        setError(err.message || "Could not load your files.");
        setFiles([]);
    } finally {
        setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);
  
  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  if (isLoading) { return <Spinner />; }
  if (error) { return <MessageBox message={error} type="error" />; }

  return (
    <div className="w-full max-w-6xl mx-auto bg-slate-800/50 p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-700">
      <h2 className="text-3xl font-bold text-slate-200 mb-6">Your Uploads</h2>
      {files.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-xl">
            <Icon path="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" className="mx-auto h-12 w-12 text-slate-500" />
            <h3 className="mt-2 text-sm font-semibold text-slate-100">No files uploaded</h3>
            <p className="mt-1 text-sm text-slate-400">Go to the upload tab to share your first file.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-700/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">File</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Downloads</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Expires</th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {files.map((file) => {
                const isExpired = file.expiresAt && new Date() > new Date(file.expiresAt);
                const isLimitReached = file.downloadLimit != null && file.downloadCount >= file.downloadLimit;
                const status = isExpired || isLimitReached ? 'Expired' : 'Active';

                return (
                  <tr key={file._id} className="hover:bg-slate-700/50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-slate-100">{file.originalName}</div>
                        <div className="text-xs text-slate-400">{formatBytes(file.size)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{`${file.downloadCount} / ${file.downloadLimit || '∞'}`}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${status === 'Active' ? 'bg-green-900/30 text-green-200' : 'bg-red-900/30 text-red-200'}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{file.expiresAt ? new Date(file.expiresAt).toLocaleString() : 'Never'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DownloadPage({ fileId }) {
    const [fileMeta, setFileMeta] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [password, setPassword] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        const fetchMetadata = async () => {
            if (!fileId) { setError("No file ID provided in URL."); setIsLoading(false); return; }
            try {
                const response = await fetch(`${API_BASE_URL}/api/files/${fileId}/meta`);
                const data = await response.json();
                if (!response.ok) { throw new Error(data.message || 'Failed to fetch file details.'); }
                setFileMeta(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchMetadata();
    }, [fileId]);

    const handleDownload = async (e) => {
        e.preventDefault();
        setError('');
        setIsDownloading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/files/${fileId}/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            const data = await response.json();
            if (!response.ok) { throw new Error(data.message || 'Download failed.'); }
            // Trigger the download
            window.location.href = data.url;
        } catch (err) {
            setError(err.message);
        } finally {
            setIsDownloading(false);
        }
    };
    
    const formatBytes = (bytes, decimals = 2) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    if (isLoading) { return <Spinner />; }
  
    return (
        <div className="w-full max-w-md mx-auto bg-slate-800/50 p-8 rounded-2xl shadow-xl border border-slate-700">
            {error && !fileMeta ? (
                 <MessageBox message={error} type="error" />
            ) : fileMeta ? (
                <>
                    <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-sky-900/30">
                          <Icon path="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" className="h-8 w-8 text-sky-400" />
                        </div>
                        <h2 className="mt-4 text-2xl font-bold text-slate-200">{fileMeta.name}</h2>
                        <p className="text-slate-400">{formatBytes(fileMeta.size)}</p>
                    </div>
                    <form onSubmit={handleDownload} className="mt-8 space-y-6">
                        {fileMeta.hasPassword && (
                            <div>
                                <label htmlFor="download-password" className="block text-sm font-medium text-slate-300">Password Required</label>
                                <input
                                    type="password"
                                    id="download-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="mt-1 block w-full px-3 py-2 border border-slate-600 bg-slate-900 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                                    required
                                />
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={isDownloading}
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-base font-semibold text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:bg-slate-500"
                        >
                            {isDownloading ? 'Preparing...' : 'Download File'}
                        </button>
                    </form>
                    {error && <div className="mt-4"><MessageBox message={error} type="error" onDismiss={() => setError('')}/></div>}
                </>
            ) : <MessageBox message="File not found or link is invalid." type="error"/>}
        </div>
    );
}

const PrivacyWarningModal = ({ piiTypes, onClose, onSecure }) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 max-w-sm m-4 p-6">
                <div className="flex items-start gap-4">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-900/30">
                        <Icon path="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" className="h-6 w-6 text-yellow-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Privacy Warning</h3>
                        <div className="mt-2">
                            <p className="text-sm text-slate-300">
                                AI scan detected potentially sensitive information:
                            </p>
                            <ul className="list-disc list-inside mt-2 text-sm text-slate-300 font-medium">
                                {piiTypes.map(type => <li key={type} className="capitalize">{type.replace(/_/g, ' ').toLowerCase()}</li>)}
                            </ul>
                            <p className="mt-3 text-sm text-slate-300">
                                We strongly recommend adding a password to protect this data.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                    <button type="button" onClick={onSecure} className="inline-flex w-full justify-center rounded-md bg-yellow-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-400 sm:w-auto">
                        Secure with Password
                    </button>
                    <button type="button" onClick={onClose} className="mt-3 inline-flex w-full justify-center rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 shadow-sm ring-1 ring-inset ring-slate-600 hover:bg-slate-600 sm:mt-0 sm:w-auto">
                        Upload Anyway
                    </button>
                </div>
            </div>
        </div>
    );
};


export default App;