import React, { useState, useEffect, useCallback } from 'react';

// --- API Configuration ---
const API_BASE_URL = 'http://localhost:5001'; // Your backend server URL

// --- GEMINI API CALLER ---
const callGeminiWithExponentialBackoff = async (prompt, maxRetries = 5) => {
  let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
  const payload = { contents: chatHistory };
  const apiKey = "AIzaSyDVW2vjEfc2-o05dT_8d5glELeh8a9SXB0"; // This is populated by the environment.
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          continue; 
        } else {
          const errorResult = await response.json();
          throw new Error(errorResult.error?.message || `HTTP error! status: ${response.status}`);
        }
      }

      const result = await response.json();
      if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
        return result.candidates[0].content.parts[0].text.trim();
      } else {
        throw new Error("Invalid response structure from Gemini API.");
      }
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error("Gemini API call failed after multiple retries:", error);
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  throw new Error("Gemini API call failed after all retries.");
};


// --- HELPER COMPONENTS ---
const Icon = ({ path, className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const MessageBox = ({ message, type, onDismiss }) => {
  if (!message) return null;
  const colors = {
    success: 'bg-green-100 border-green-400 text-green-700',
    error: 'bg-red-100 border-red-400 text-red-700',
    info: 'bg-blue-100 border-blue-400 text-blue-700',
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


// --- CORE COMPONENTS ---

function UploadForm({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [downloadLimit, setDownloadLimit] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isGeneratingPassword, setIsGeneratingPassword] = useState(false);
  const [isDraftingMessage, setIsDraftingMessage] = useState(false);
  const [shareMessage, setShareMessage] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.size > 100 * 1024 * 1024) {
        setError("File size cannot exceed 100MB.");
        setFile(null);
    } else {
        setFile(selectedFile);
        setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    setError('');
    setIsLoading(true);
    setGeneratedLink('');
    setShareMessage('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('expiresInHours', expiresInHours);
    formData.append('downloadLimit', downloadLimit);
    formData.append('password', password);

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setGeneratedLink(result.link);
        onUploadSuccess();
      } else {
        setError(result.message || 'File upload failed. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Could not connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGeneratePassword = async () => {
    setIsGeneratingPassword(true);
    setError('');
    try {
        const prompt = "Generate a strong, secure, but easy-to-remember password with 4 random English words joined by a hyphen. Example: cosmic-yellow-river-diamond";
        const newPassword = await callGeminiWithExponentialBackoff(prompt);
        setPassword(newPassword);
    } catch (err) {
        setError("Failed to generate password. Please try again.");
    } finally {
        setIsGeneratingPassword(false);
    }
  };

  const handleDraftMessage = async () => {
    if (!file) return;
    setIsDraftingMessage(true);
    setError('');
    try {
        const prompt = `Draft a short, friendly, and professional message for sharing a file named "${file.name}". Include a placeholder like "[Link]" where the user should insert the link.`;
        const newMessage = await callGeminiWithExponentialBackoff(prompt);
        setShareMessage(newMessage);
    } catch (err) {
        setError("Failed to draft message. Please try again.");
    } finally {
        setIsDraftingMessage(false);
    }
  };

  const copyToClipboard = (text) => {
      navigator.clipboard.writeText(text).catch(err => console.error('Failed to copy: ', err));
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-white p-8 rounded-2xl shadow-lg">
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Secure File Share</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">File Upload</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <Icon path="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500">
                  <span>Upload a file</span>
                  <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">{file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` : 'PNG, JPG, PDF, etc. up to 100MB'}</p>
            </div>
          </div>
        </div>
        <div>
          <label htmlFor="expires" className="block text-sm font-medium text-gray-700">Link Expires In</label>
          <select id="expires" value={expiresInHours} onChange={e => setExpiresInHours(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
            <option value={1}>1 Hour</option>
            <option value={24}>24 Hours</option>
            <option value={72}>3 Days</option>
            <option value={168}>7 Days</option>
          </select>
        </div>

        <div>
          <label htmlFor="limit" className="block text-sm font-medium text-gray-700">Download Limit (optional)</label>
          <input type="number" id="limit" value={downloadLimit} onChange={e => setDownloadLimit(e.target.value)} placeholder="e.g., 10" className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password (optional)</label>
          <div className="flex items-center gap-2 mt-1">
            <div className="relative flex-grow">
              <input type={showPassword ? 'text' : 'password'} id="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Add extra security" className="focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5">
                <Icon path={showPassword ? "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L6.228 6.228" : "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.432 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z"} className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <button type="button" onClick={handleGeneratePassword} disabled={isGeneratingPassword} className="px-3 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-100">
              {isGeneratingPassword ? '...' : 'Generate'}
            </button>
          </div>
        </div>
        
        <MessageBox message={error} type="error" onDismiss={() => setError('')} />

        {generatedLink && (
            <div className="p-4 bg-gray-100 rounded-lg space-y-4">
                <div>
                    <p className="text-sm font-medium text-gray-800">Your secure link is ready:</p>
                    <div className="mt-2 flex items-center space-x-2">
                        <input type="text" readOnly value={generatedLink} className="flex-1 p-2 border border-gray-300 rounded-md bg-white text-sm" />
                        <button type="button" onClick={() => copyToClipboard(generatedLink)} className="p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            <Icon path="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.03 1.126 0 1.131.094 1.976 1.057 1.976 2.192v1.392M15.75 7.5v1.392a2.25 2.25 0 01-2.25 2.25h-5.379a2.25 2.25 0 01-2.25-2.25V7.5m9 7.5H5.25A2.25 2.25 0 013 12.75V9A2.25 2.25 0 015.25 6.75h9.5A2.25 2.25 0 0117.25 9v3.75a2.25 2.25 0 01-2.25 2.25z" className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                 <div>
                    <button type="button" onClick={handleDraftMessage} disabled={isDraftingMessage} className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-400">
                       <Icon path="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.528l.259 1.035.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 18l1.036.259a3.375 3.375 0 002.455 2.456z" className="w-4 h-4" />
                        {isDraftingMessage ? 'Drafting...' : 'AI Draft Share Message'}
                    </button>
                    {shareMessage && (
                        <div className="mt-2 p-3 bg-gray-200 rounded-md">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{shareMessage}</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        <div>
          <button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed">
            {isLoading ? (
                <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Link...
                </>
            ) : 'Generate Secure Link'}
          </button>
        </div>
      </form>
    </div>
  );
}

function DownloadPage({ fileId }) {
    const [fileMeta, setFileMeta] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('Verifying link...');
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/files/${fileId}/meta`);
                const meta = await response.json();
                if (!response.ok) throw new Error(meta.message || 'Failed to get file info.');
                setFileMeta(meta);
                setStatus(meta.hasPassword ? 'Password required.' : 'Ready to download.');
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        if (fileId) fetchMetadata();
    }, [fileId]);
    
    const handleDownload = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setPasswordError('');
        setError('');
        setStatus('Preparing download...');
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/files/${fileId}/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Download failed.');
            
            window.location.href = result.url;
            setStatus('Download started successfully!');
        } catch (err) {
            if (err.message === "Incorrect password.") {
                setPasswordError(err.message);
            } else {
                setError(err.message);
            }
            setStatus('Download failed.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading && !fileMeta) {
        return <div className="w-full max-w-md mx-auto text-center p-8"><h2 className="text-2xl font-bold text-gray-800">Verifying Link...</h2></div>;
    }
    
    if (error) {
        return (
            <div className="w-full max-w-md mx-auto bg-white p-8 rounded-2xl shadow-lg text-center">
                <Icon path="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" className="mx-auto h-12 w-12 text-red-500" />
                <h2 className="mt-4 text-2xl font-bold text-gray-800">Link Error</h2>
                <p className="mt-2 text-gray-600">{error}</p>
            </div>
        );
    }

    if (!fileMeta) {
        return null;
    }

    return (
        <div className="w-full max-w-md mx-auto bg-white p-8 rounded-2xl shadow-lg">
            <div className="text-center">
                <Icon path="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" className="mx-auto h-12 w-12 text-indigo-600" />
                <h2 className="mt-4 text-2xl font-bold text-gray-800">Download File</h2>
                <p className="mt-2 text-gray-600 truncate">{fileMeta.name}</p>
                <p className="text-sm text-gray-500">File Size: {(fileMeta.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            
            <form onSubmit={handleDownload} className="mt-8 space-y-6">
                {fileMeta.hasPassword && (
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                         <MessageBox message={passwordError} type="error" onDismiss={() => setPasswordError('')} />
                    </div>
                )}
                
                <button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300">
                    {isLoading ? 'Processing...' : `Download Now`}
                </button>
                <p className="text-center text-sm text-gray-500">{status}</p>
            </form>
        </div>
    );
}

function Dashboard({ refreshKey }) {
    const [files, setFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchFiles = useCallback(async () => {
        setIsLoading(true);
        try {
            // This endpoint needs to be created in the backend to fetch user-specific files.
            // For now, it's a placeholder.
            // const response = await fetch(`${API_BASE_URL}/api/dashboard/files`);
            // const userFiles = await response.json();
            // setFiles(userFiles);
            setFiles([]); // Mocking empty files for now
        } catch (error) {
            console.error("Failed to fetch dashboard files");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFiles();
    }, [refreshKey, fetchFiles]);
    
    const copyToClipboard = (text) => {
      navigator.clipboard.writeText(text);
    };

    if (isLoading) {
        return <div className="text-center p-8 text-gray-500">Loading dashboard...</div>;
    }

    if (files.length === 0) {
        return (
            <div className="text-center p-8 bg-white rounded-lg shadow-md">
                <Icon path="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No files uploaded yet</h3>
                <p className="mt-1 text-sm text-gray-500">Your uploaded file links will appear here.</p>
            </div>
        );
    }
    
    const formatBytes = (bytes, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    return (
        <div className="w-full max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">My Uploads</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Name</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Downloads</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Link</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {files.map((file) => (
                            <tr key={file.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900 truncate" style={{maxWidth: '200px'}}>{file.name}</div>
                                    <div className="text-sm text-gray-500">{formatBytes(file.size)}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        file.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                        {file.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {file.downloadCount} / {file.downloadLimit || '∞'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => copyToClipboard(file.link)} className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1">
                                        <Icon path="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.03 1.126 0 1.131.094 1.976 1.057 1.976 2.192v1.392M15.75 7.5v1.392a2.25 2.25 0 01-2.25 2.25h-5.379a2.25 2.25 0 01-2.25-2.25V7.5m9 7.5H5.25A2.25 2.25 0 013 12.75V9A2.25 2.25 0 015.25 6.75h9.5A2.25 2.25 0 0117.25 9v3.75a2.25 2.25 0 01-2.25 2.25z" className="w-4 h-4" />
                                        Copy
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}


// --- MAIN APP ---
export default function App() {
  const [page, setPage] = useState('upload');
  const [downloadId, setDownloadId] = useState(null);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  useEffect(() => {
    const path = window.location.pathname;
    const parts = path.split('/');
    if (parts.length === 3 && parts[1] === 'download' && parts[2]) {
      setDownloadId(parts[2]);
      setPage('download');
    }
  }, []);

  const handleUploadSuccess = () => {
    setDashboardRefreshKey(prevKey => prevKey + 1);
  };
  
  const renderPage = () => {
    const path = window.location.pathname;
    const parts = path.split('/');
    if (parts.length === 3 && parts[1] === 'download' && parts[2]) {
        return <DownloadPage fileId={parts[2]} />;
    }

    switch (page) {
      case 'dashboard':
        return <Dashboard refreshKey={dashboardRefreshKey} />;
      case 'upload':
      default:
        return <UploadForm onUploadSuccess={handleUploadSuccess} />;
    }
  };

  const NavButton = ({ targetPage, iconPath, label }) => (
    <button 
      onClick={() => setPage(targetPage)} 
      className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-lg transition-colors duration-200 ${page === targetPage ? 'bg-indigo-600 text-white' : 'hover:bg-gray-200 text-gray-600'}`}
    >
      <Icon path={iconPath} className="w-5 h-5" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <header className="mb-8">
            <nav className="bg-white p-3 rounded-xl shadow-md max-w-md mx-auto">
                <div className="flex justify-around items-center">
                    <NavButton targetPage="upload" iconPath="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3.75 19.5h16.5a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0020.25 4.5h-16.5A2.25 2.25 0 001.5 6.75v10.5A2.25 2.25 0 003.75 19.5z" label="Upload" />
                    <NavButton targetPage="dashboard" iconPath="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" label="Dashboard" />
                </div>
            </nav>
        </header>
        <main>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
