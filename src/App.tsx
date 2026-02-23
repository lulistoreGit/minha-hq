import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Book, 
  Image as ImageIcon, 
  Send, 
  Loader2, 
  Trash2, 
  Languages, 
  ChevronRight, 
  ChevronLeft,
  Download,
  Camera,
  Layout
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateComicStory, generatePanelImage, translateText } from './services/geminiService';

interface Panel {
  id?: string;
  image_url: string;
  caption: string;
  order_index: number;
}

interface Comic {
  id: string;
  title: string;
  description: string;
  panels?: Panel[];
}

const LANGUAGES = [
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'ja', name: '日本語' }
];

export default function App() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [currentComic, setCurrentComic] = useState<Comic | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [userImage, setUserImage] = useState<string | null>(null);
  const [language, setLanguage] = useState('pt-BR');
  const [view, setView] = useState<'home' | 'editor' | 'viewer'>('home');
  const [isTranslating, setIsTranslating] = useState(false);
  const [layout, setLayout] = useState<'grid' | 'stack'>('grid');
  const [generationProgress, setGenerationProgress] = useState<{current: number, total: number} | null>(null);

  useEffect(() => {
    fetchComics();
  }, []);

  const fetchComics = async () => {
    const res = await fetch('/api/comics');
    const data = await res.json();
    setComics(data);
  };

  const handleCreateComic = async () => {
    if (!prompt) return;
    setIsLoading(true);
    setGenerationProgress({ current: 0, total: 0 });
    try {
      const story = await generateComicStory(prompt, language);
      if (!story.panels || story.panels.length === 0) throw new Error("Falha ao gerar história");
      
      setGenerationProgress({ current: 0, total: story.panels.length });

      const res = await fetch('/api/comics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: story.title, description: prompt })
      });
      const newComic = await res.json();
      
      const panels: Panel[] = [];
      for (let i = 0; i < story.panels.length; i++) {
        setGenerationProgress(prev => prev ? { ...prev, current: i + 1 } : null);
        const panelData = story.panels[i];
        const imageUrl = await generatePanelImage(panelData.visualDescription, userImage || undefined);
        
        if (imageUrl) {
          const panelRes = await fetch(`/api/comics/${newComic.id}/panels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image_url: imageUrl,
              caption: panelData.caption,
              order_index: i
            })
          });
          const panel = await panelRes.json();
          panels.push(panel);
        }
      }

      const fullComic = { ...newComic, panels };
      setComics(prev => [fullComic, ...prev]);
      setCurrentComic(fullComic);
      setView('viewer');
      setPrompt('');
      setUserImage(null);
    } catch (error) {
      console.error("Erro ao criar HQ:", error);
      alert("Ocorreu um erro ao gerar sua HQ. Tente novamente.");
    } finally {
      setIsLoading(false);
      setIsCreating(false);
      setGenerationProgress(null);
    }
  };

  const handleDeleteComic = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja excluir esta HQ?")) return;
    
    try {
      // Note: We need a delete route in server.ts, I'll add it later or just filter locally for now
      // For now, let's assume we'll add the route
      await fetch(`/api/comics/${id}`, { method: 'DELETE' });
      setComics(comics.filter(c => c.id !== id));
      if (currentComic?.id === id) setView('home');
    } catch (error) {
      console.error("Erro ao excluir:", error);
    }
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('comic-content');
    if (!element) return;
    
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;
    
    const canvas = await html2canvas(element, { 
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#f5f5f4' // Match stone-100
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${currentComic?.title || 'minha-hq'}.pdf`);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const translateUI = async (targetLang: string) => {
    // In a real app, we'd use i18next, but here we can use Gemini for dynamic translation if needed
    // For now, we just update the state to trigger any language-specific logic
    setLanguage(targetLang);
  };

  const renderHome = () => (
    <div className="max-w-6xl mx-auto p-6">
      <header className="flex justify-between items-center mb-12">
        <h1 className="comic-title text-5xl">Minha HQ</h1>
        <div className="flex gap-4 items-center">
          <div className="relative group">
            <button className="flex items-center gap-2 bg-white px-4 py-2 comic-border font-bold">
              <Languages size={20} />
              {LANGUAGES.find(l => l.code === language)?.name}
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-white comic-border hidden group-hover:block z-50">
              {LANGUAGES.map(lang => (
                <button 
                  key={lang.code}
                  onClick={() => translateUI(lang.code)}
                  className="w-full text-left px-4 py-2 hover:bg-yellow-400 font-bold border-b border-black last:border-0"
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-yellow-400 px-6 py-3 comic-border font-bold flex items-center gap-2 hover:bg-yellow-300 transition-colors"
          >
            <Plus size={24} />
            CRIAR NOVA HQ
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {comics.map(comic => (
          <motion.div 
            key={comic.id}
            whileHover={{ scale: 1.02 }}
            onClick={async () => {
              const res = await fetch(`/api/comics/${comic.id}`);
              const data = await res.json();
              setCurrentComic(data);
              setView('viewer');
            }}
            className="comic-panel cursor-pointer group"
          >
            <div className="aspect-[3/4] bg-stone-200 mb-4 overflow-hidden relative">
              <div className="absolute inset-0 flex items-center justify-center text-stone-400">
                <Book size={64} />
              </div>
              {/* Placeholder for first panel image if available */}
            </div>
            <h3 className="font-comic text-2xl mb-2">{comic.title}</h3>
            <div className="flex justify-between items-center">
              <p className="text-sm text-stone-600 line-clamp-1 flex-1">{comic.description}</p>
              <button 
                onClick={(e) => handleDeleteComic(comic.id, e)}
                className="text-stone-400 hover:text-red-500 p-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </motion.div>
        ))}
        
        {comics.length === 0 && !isLoading && (
          <div className="col-span-full text-center py-20 bg-white comic-border">
            <Book size={80} className="mx-auto mb-4 text-stone-300" />
            <h2 className="font-comic text-3xl mb-2">Nenhuma HQ ainda</h2>
            <p className="text-stone-500">Comece sua jornada criando sua primeira história!</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white comic-border w-full max-w-2xl p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-comic text-3xl">Nova Aventura</h2>
                <button onClick={() => setIsCreating(false)} className="text-stone-500 hover:text-black">
                  <Trash2 size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block font-bold mb-2 uppercase text-sm tracking-widest">Sobre o que é sua história?</label>
                  <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ex: Um herói que descobre poderes ao comer pão de queijo..."
                    className="w-full p-4 comic-border h-32 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-2 uppercase text-sm tracking-widest">Quer usar sua foto como personagem?</label>
                  <div className="flex gap-4 items-center">
                    <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-black p-6 cursor-pointer hover:bg-stone-50 transition-colors">
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      {userImage ? (
                        <img src={userImage} alt="Preview" className="w-20 h-20 object-cover rounded-full border-2 border-black" />
                      ) : (
                        <>
                          <Camera size={32} className="mb-2" />
                          <span className="text-sm font-bold">Upload de Foto</span>
                        </>
                      )}
                    </label>
                    {userImage && (
                      <button onClick={() => setUserImage(null)} className="text-red-500 font-bold">Remover</button>
                    )}
                  </div>
                </div>

                <button 
                  onClick={handleCreateComic}
                  disabled={isLoading || !prompt}
                  className="w-full bg-yellow-400 py-4 comic-border font-bold text-xl flex flex-col items-center justify-center gap-1 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="flex items-center gap-3">
                        <Loader2 className="animate-spin" />
                        {generationProgress?.total === 0 ? 'CRIANDO ROTEIRO...' : `GERANDO PAINEL ${generationProgress?.current}/${generationProgress?.total}`}
                      </div>
                      {generationProgress && generationProgress.total > 0 && (
                        <div className="w-full max-w-xs h-2 bg-black/10 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="h-full bg-black transition-all duration-500" 
                            style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Send />
                      CRIAR HQ AGORA!
                    </div>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderViewer = () => {
    if (!currentComic) return null;
    return (
      <div className="max-w-4xl mx-auto p-6">
        <button 
          onClick={() => setView('home')}
          className="mb-8 flex items-center gap-2 font-bold hover:underline"
        >
          <ChevronLeft /> VOLTAR PARA MINHA BIBLIOTECA
        </button>

        <div id="comic-content" className="bg-white p-8 comic-border mb-12">
          <h1 className="comic-title text-6xl mb-4 text-center">{currentComic.title}</h1>
          <p className="text-center text-stone-500 italic mb-12">"{currentComic.description}"</p>

          <div className={layout === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-8" : "flex flex-col gap-12 max-w-2xl mx-auto"}>
            {currentComic.panels?.map((panel, idx) => (
              <motion.div 
                key={panel.id || idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="comic-panel"
              >
                <div className="aspect-square bg-stone-100 mb-4 overflow-hidden border-2 border-black">
                  <img src={panel.image_url} alt={`Panel ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
                <div className="bg-yellow-100 p-4 border-2 border-black relative">
                  <div className="absolute -top-3 left-4 bg-white px-2 border-2 border-black text-xs font-bold uppercase">
                    Painel {idx + 1}
                  </div>
                  <p className="font-medium leading-tight">{panel.caption}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-4 mb-20">
          <button 
            onClick={handleDownloadPDF}
            className="bg-black text-white px-8 py-4 comic-border font-bold flex items-center gap-2 hover:bg-stone-800"
          >
            <Download size={20} />
            BAIXAR HQ (PDF)
          </button>
          <button 
            onClick={() => setLayout(layout === 'grid' ? 'stack' : 'grid')}
            className="bg-white px-8 py-4 comic-border font-bold flex items-center gap-2 hover:bg-stone-50"
          >
            <Layout size={20} />
            {layout === 'grid' ? 'MUDAR PARA LISTA' : 'MUDAR PARA GRADE'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-stone-100">
      <AnimatePresence mode="wait">
        {view === 'home' && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderHome()}
          </motion.div>
        )}
        {view === 'viewer' && (
          <motion.div key="viewer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderViewer()}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Footer for App Store vibes */}
      <footer className="bg-black text-white py-12 px-6 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div>
            <h2 className="font-comic text-3xl mb-2">Minha HQ</h2>
            <p className="text-stone-400">A revolução das histórias em quadrinhos com IA.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-stone-800 p-4 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-stone-700">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-black">
                <ImageIcon size={24} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-stone-500">Disponível na</p>
                <p className="font-bold">App Store</p>
              </div>
            </div>
            <div className="bg-stone-800 p-4 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-stone-700">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-black">
                <ChevronRight size={24} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-stone-500">Disponível no</p>
                <p className="font-bold">Google Play</p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
