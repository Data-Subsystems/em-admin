"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ScoreboardModel, COLOR_PALETTE, LED_COLORS } from "@/lib/supabase";
import ColorizedScoreboard from "@/components/ColorizedScoreboard";

// S3 URL for generated images
const S3_BASE_URL = "https://em-admin-assets.s3.us-east-1.amazonaws.com";

type Tab = "scoreboards" | "customizer" | "analysis";
type ColorTab = "face" | "accent" | "led";

interface StatusCounts {
  pending?: number;
  processing?: number;
  completed?: number;
  error?: number;
}

// Use local proxy to avoid CORS issues with canvas
const IMAGE_BASE_URL = "/api/images";

// Color names in display order (matching reference UI)
const COLOR_ORDER = [
  "navy_blue", "egyptian_blue", "royal_blue", "icy_blue",
  "shamrock_green", "jolly_green", "hunter_green", "silver_gray", "matte_black",
  "indigo_purple", "power_purple", "merchant_maroon", "cardinal_red",
  "racing_red", "tiger_orange", "golden_yellow", "metallic_gold", "white"
];

const COLOR_DISPLAY_NAMES: Record<string, string> = {
  navy_blue: "Navy Blue",
  egyptian_blue: "Egyptian Blue",
  royal_blue: "Royal Blue",
  icy_blue: "Icy Blue",
  shamrock_green: "Shamrock Green",
  jolly_green: "Jolly Green",
  hunter_green: "Hunter Green",
  silver_gray: "Silver Gray",
  matte_black: "Matte Black",
  indigo_purple: "Indigo Purple",
  power_purple: "Power Purple",
  merchant_maroon: "Merchant Maroon",
  cardinal_red: "Cardinal Red",
  racing_red: "Racing Red",
  tiger_orange: "Tiger Orange",
  golden_yellow: "Golden Yellow",
  metallic_gold: "Metallic Gold",
  white: "White",
  none: "None"
};

// localStorage keys
const STORAGE_KEYS = {
  activeTab: "em-admin-tab",
  selectedId: "em-admin-selected",
  colorTab: "em-admin-color-tab",
  faceColor: "em-admin-face",
  accentColor: "em-admin-accent",
  ledColor: "em-admin-led",
  upgradeETN: "em-admin-etn",
};

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("scoreboards");
  const [scoreboards, setScoreboards] = useState<ScoreboardModel[]>([]);
  const [selectedScoreboard, setSelectedScoreboard] = useState<ScoreboardModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [urlModel, setUrlModel] = useState<string | null>(null);

  // Customization state
  const [colorTab, setColorTab] = useState<ColorTab>("face");
  const [faceColor, setFaceColor] = useState<string>("matte_black");
  const [accentColor, setAccentColor] = useState<string>("none");
  const [ledColor, setLedColor] = useState<string>("red");
  const [upgradeETN, setUpgradeETN] = useState(false);

  // Generated image state
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [useGeneratedMode, setUseGeneratedMode] = useState(false);

  // Progress tracking state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);

  // Generate all variations state
  const [generatingAll, setGeneratingAll] = useState(false);
  const [modelProgress, setModelProgress] = useState<{
    totalTasks: number;
    completed: number;
    pending: number;
    processing: number;
    percentComplete: number;
  } | null>(null);

  // Update URL when state changes
  const updateUrl = useCallback((tab: Tab, model?: string | null, colors?: { face?: string; accent?: string; led?: string }) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (model) params.set("model", model);
    if (colors?.face && colors.face !== "matte_black") params.set("face", colors.face);
    if (colors?.accent && colors.accent !== "none") params.set("accent", colors.accent);
    if (colors?.led && colors.led !== "red") params.set("led", colors.led);

    const newUrl = `/?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }, []);

  // Read URL params and localStorage on mount
  useEffect(() => {
    // URL params take priority over localStorage
    const urlTab = searchParams.get("tab") as Tab | null;
    const urlModelParam = searchParams.get("model");
    const urlFace = searchParams.get("face");
    const urlAccent = searchParams.get("accent");
    const urlLed = searchParams.get("led");

    // Get localStorage values as fallback
    const savedTab = localStorage.getItem(STORAGE_KEYS.activeTab) as Tab | null;
    const savedColorTab = localStorage.getItem(STORAGE_KEYS.colorTab) as ColorTab | null;
    const savedFace = localStorage.getItem(STORAGE_KEYS.faceColor);
    const savedAccent = localStorage.getItem(STORAGE_KEYS.accentColor);
    const savedLed = localStorage.getItem(STORAGE_KEYS.ledColor);
    const savedETN = localStorage.getItem(STORAGE_KEYS.upgradeETN);

    // Apply URL params first, then localStorage fallback
    if (urlTab) {
      setActiveTab(urlTab);
    } else if (savedTab) {
      setActiveTab(savedTab);
    }

    if (urlModelParam) {
      setUrlModel(urlModelParam);
    }

    if (urlFace) {
      setFaceColor(urlFace);
    } else if (savedFace) {
      setFaceColor(savedFace);
    }

    if (urlAccent) {
      setAccentColor(urlAccent);
    } else if (savedAccent) {
      setAccentColor(savedAccent);
    }

    if (urlLed) {
      setLedColor(urlLed);
    } else if (savedLed) {
      setLedColor(savedLed);
    }

    if (savedColorTab) setColorTab(savedColorTab);
    if (savedETN) setUpgradeETN(savedETN === "true");

    setInitialized(true);
  }, [searchParams]);

  // Save state to localStorage when it changes
  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(STORAGE_KEYS.activeTab, activeTab);
  }, [activeTab, initialized]);

  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(STORAGE_KEYS.colorTab, colorTab);
  }, [colorTab, initialized]);

  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(STORAGE_KEYS.faceColor, faceColor);
  }, [faceColor, initialized]);

  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(STORAGE_KEYS.accentColor, accentColor);
  }, [accentColor, initialized]);

  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(STORAGE_KEYS.ledColor, ledColor);
  }, [ledColor, initialized]);

  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(STORAGE_KEYS.upgradeETN, String(upgradeETN));
  }, [upgradeETN, initialized]);

  useEffect(() => {
    if (!initialized) return;
    if (selectedScoreboard) {
      localStorage.setItem(STORAGE_KEYS.selectedId, selectedScoreboard.id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.selectedId);
    }
  }, [selectedScoreboard, initialized]);

  // Update URL when state changes
  useEffect(() => {
    if (!initialized) return;
    updateUrl(
      activeTab,
      selectedScoreboard?.model_name,
      { face: faceColor, accent: accentColor, led: ledColor }
    );
  }, [activeTab, selectedScoreboard, faceColor, accentColor, ledColor, initialized, updateUrl]);

  // Find scoreboard from URL param after data loads
  useEffect(() => {
    if (scoreboards.length > 0 && urlModel && !selectedScoreboard) {
      const found = scoreboards.find(
        (s) => s.model_name.toLowerCase() === urlModel.toLowerCase()
      );
      if (found) {
        setSelectedScoreboard(found);
        if (activeTab === "scoreboards") {
          setActiveTab("customizer");
        }
      }
    }
  }, [scoreboards, urlModel, selectedScoreboard, activeTab]);

  // Get image URL (via local proxy to avoid CORS)
  const getImageUrl = (filename: string) => {
    return `${IMAGE_BASE_URL}/${filename}`;
  };

  // Fetch scoreboards
  const fetchScoreboards = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/scoreboards?limit=500");
      const data = await response.json();
      if (data.scoreboards) {
        setScoreboards(data.scoreboards);
      }
    } catch (error) {
      console.error("Error fetching scoreboards:", error);
    }
    setLoading(false);
  }, []);

  // Fetch analysis status
  const fetchAnalysisStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/analyze/batch");
      const data = await response.json();
      if (data.statusCounts) {
        setStatusCounts(data.statusCounts);
      }
    } catch (error) {
      console.error("Error fetching status:", error);
    }
  }, []);

  // Import scoreboards
  const handleImport = async () => {
    setImporting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/scoreboards/import", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: `Imported ${data.imported} scoreboards (${data.withColorConfig} with color config)`,
        });
        await fetchScoreboards();
        await fetchAnalysisStatus();
      } else {
        setMessage({ type: "error", text: data.error || "Import failed" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Import failed" });
    }
    setImporting(false);
  };

  // Run batch analysis
  const handleBatchAnalysis = async (limit: number = 10) => {
    setAnalyzing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/analyze/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      const data = await response.json();
      if (data.processed !== undefined) {
        setMessage({
          type: "success",
          text: `Analyzed ${data.processed} scoreboards (${data.errors} errors)`,
        });
        await fetchScoreboards();
        await fetchAnalysisStatus();
      } else {
        setMessage({ type: "error", text: data.error || "Analysis failed" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Analysis failed" });
    }
    setAnalyzing(false);
  };

  // Analyze single scoreboard
  const handleAnalyzeSingle = async (id: string) => {
    setAnalyzing(true);
    try {
      const response = await fetch(`/api/scoreboards/${id}/analyze`, { method: "POST" });
      const data = await response.json();
      if (data.success) {
        setSelectedScoreboard(data.scoreboard);
        await fetchScoreboards();
        await fetchAnalysisStatus();
      }
    } catch (error) {
      console.error("Error analyzing:", error);
    }
    setAnalyzing(false);
  };

  // Apply color selection
  const applyColorSelection = (color: string) => {
    if (colorTab === "face") {
      setFaceColor(color);
    } else if (colorTab === "accent") {
      setAccentColor(color);
    } else {
      setLedColor(color);
    }
    // Clear generated image when color changes
    if (useGeneratedMode) {
      setGeneratedImageUrl(null);
      setGenerationStatus(null);
    }
  };

  // Check if generated image exists
  const checkGeneratedImage = useCallback(async () => {
    if (!selectedScoreboard || !useGeneratedMode) return;

    const params = new URLSearchParams({
      model: selectedScoreboard.model_name,
      primary: faceColor,
      accent: accentColor,
      led: ledColor,
    });

    try {
      const response = await fetch(`/api/colorpicker/generate?${params}`);
      const data = await response.json();

      if (data.exists) {
        setGeneratedImageUrl(data.url);
        setGenerationStatus("ready");
      } else if (data.task) {
        setGenerationStatus(data.task.status);
        if (data.task.status === "completed" && data.task.s3_key) {
          setGeneratedImageUrl(`${S3_BASE_URL}/${data.task.s3_key}`);
        }
      } else {
        setGeneratedImageUrl(null);
        setGenerationStatus(null);
      }
    } catch (error) {
      console.error("Error checking generated image:", error);
    }
  }, [selectedScoreboard, faceColor, accentColor, ledColor, useGeneratedMode]);

  // Fetch model progress (for generate all)
  const fetchModelProgress = useCallback(async () => {
    if (!selectedScoreboard) return;
    try {
      const response = await fetch(`/api/colorpicker/generate-all?model=${encodeURIComponent(selectedScoreboard.model_name)}`);
      const data = await response.json();
      setModelProgress(data);
    } catch (error) {
      console.error("Error fetching model progress:", error);
    }
  }, [selectedScoreboard]);

  // Generate all variations for the model
  const handleGenerateAll = async () => {
    if (!selectedScoreboard) return;

    setGeneratingAll(true);
    setMessage(null);

    try {
      const response = await fetch("/api/colorpicker/generate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedScoreboard.model_name }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: "success",
          text: data.message,
        });
        fetchModelProgress();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to queue tasks" });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to queue tasks",
      });
    }

    setGeneratingAll(false);
  };

  // Poll for generation progress
  const pollProgress = useCallback(async (sid: string) => {
    try {
      const response = await fetch(`/api/colorpicker/progress?session_id=${sid}`);
      const data = await response.json();

      setProgressStep(data.current_step || "Processing...");
      setProgressPercent(data.progress_percent || 0);

      if (data.status === "completed" && data.result_url) {
        setGeneratedImageUrl(data.result_url + "?t=" + Date.now());
        setGenerationStatus("ready");
        setGenerating(false);
        setMessage({
          type: "success",
          text: "Image generated successfully!"
        });
        return true; // Stop polling
      } else if (data.status === "error") {
        setGenerationStatus("error");
        setGenerating(false);
        setMessage({ type: "error", text: data.error_message || "Generation failed" });
        return true; // Stop polling
      }

      return false; // Continue polling
    } catch (error) {
      console.error("Error polling progress:", error);
      return false;
    }
  }, []);

  // Generate image instantly via Modal
  const handleGenerate = async () => {
    if (!selectedScoreboard) return;

    // Generate unique session ID for progress tracking
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    setGenerating(true);
    setGenerationStatus("generating");
    setProgressStep("Starting...");
    setProgressPercent(0);
    setMessage(null);

    // Start the generation request
    const generatePromise = fetch("/api/colorpicker/generate-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: selectedScoreboard.model_name,
        primary: faceColor,
        accent: accentColor,
        led: ledColor,
        session_id: newSessionId,
      }),
    });

    // Start polling for progress (with a small delay to let the request reach Modal)
    const pollInterval = setInterval(async () => {
      const done = await pollProgress(newSessionId);
      if (done) {
        clearInterval(pollInterval);
      }
    }, 500); // Poll every 500ms

    try {
      const response = await generatePromise;
      const data = await response.json();

      // Clear polling since we got the final response
      clearInterval(pollInterval);

      if (data.success && data.url) {
        setGeneratedImageUrl(data.url + "?t=" + Date.now()); // Cache bust
        setGenerationStatus("ready");
        setProgressStep("Complete!");
        setProgressPercent(100);
        setMessage({
          type: "success",
          text: data.exists ? "Image loaded from cache!" : `Generated in ${data.duration_ms}ms`
        });
      } else {
        setGenerationStatus("error");
        setMessage({ type: "error", text: data.error || "Generation failed" });
      }
    } catch (error) {
      clearInterval(pollInterval);
      setGenerationStatus("error");
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Generation failed",
      });
    }

    setGenerating(false);
  };

  // Check for generated image when colors change (in generated mode)
  useEffect(() => {
    if (useGeneratedMode && selectedScoreboard) {
      checkGeneratedImage();
    }
  }, [useGeneratedMode, selectedScoreboard, faceColor, accentColor, ledColor, checkGeneratedImage]);

  // Fetch model progress when scoreboard changes
  useEffect(() => {
    if (selectedScoreboard && useGeneratedMode) {
      fetchModelProgress();
    }
  }, [selectedScoreboard, useGeneratedMode, fetchModelProgress]);

  useEffect(() => {
    fetchScoreboards();
    fetchAnalysisStatus();
  }, [fetchScoreboards, fetchAnalysisStatus]);

  // Restore selected scoreboard after data loads (only if no URL param)
  useEffect(() => {
    if (scoreboards.length > 0 && !selectedScoreboard && initialized && !urlModel) {
      const savedId = localStorage.getItem(STORAGE_KEYS.selectedId);
      if (savedId) {
        const saved = scoreboards.find((s) => s.id === savedId);
        if (saved) setSelectedScoreboard(saved);
      }
    }
  }, [scoreboards, selectedScoreboard, initialized, urlModel]);

  // Get current color for display
  const getCurrentColor = () => {
    if (colorTab === "face") return faceColor;
    if (colorTab === "accent") return accentColor;
    return ledColor;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-[#1a1a2e] text-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#8B3A3A] rounded-lg flex items-center justify-center font-bold text-lg">
              EM
            </div>
            <div>
              <h1 className="text-xl font-semibold">Electro-Mech Admin</h1>
              <p className="text-gray-400 text-xs">Scoreboard Configuration Tool</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              {scoreboards.length} models loaded
            </span>
            <a
              href="/batch"
              className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded transition"
            >
              Batch Processing
            </a>
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1">
            {[
              { id: "scoreboards", label: "Scoreboards Library", icon: "grid" },
              { id: "customizer", label: "Customizer", icon: "palette" },
              { id: "analysis", label: "Analysis", icon: "chart" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`py-3 px-5 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-[#8B3A3A] text-[#8B3A3A]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div
            className={`p-4 rounded-lg flex items-center justify-between ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="text-lg font-bold hover:opacity-70"
            >
              x
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Scoreboards Tab */}
        {activeTab === "scoreboards" && (
          <div className="space-y-6">
            {/* Actions Bar */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between flex-wrap gap-4">
              <div className="flex gap-3">
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="px-4 py-2 bg-[#1a1a2e] text-white rounded-lg hover:bg-[#2a2a3e] disabled:opacity-50 transition font-medium text-sm"
                >
                  {importing ? "Importing..." : "Import from Files"}
                </button>
                <button
                  onClick={() => handleBatchAnalysis(10)}
                  disabled={analyzing}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition font-medium text-sm"
                >
                  {analyzing ? "Analyzing..." : "Analyze 10"}
                </button>
                <button
                  onClick={() => handleBatchAnalysis(50)}
                  disabled={analyzing}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition font-medium text-sm"
                >
                  Analyze 50
                </button>
              </div>

              {/* Stats Pills */}
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                  <span className="font-semibold">{scoreboards.length}</span> Total
                </span>
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                  <span className="font-semibold">{statusCounts.pending || 0}</span> Pending
                </span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  <span className="font-semibold">{statusCounts.completed || 0}</span> Done
                </span>
                {(statusCounts.error || 0) > 0 && (
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                    <span className="font-semibold">{statusCounts.error}</span> Errors
                  </span>
                )}
              </div>
            </div>

            {/* Scoreboards Grid */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              {loading ? (
                <div className="text-center py-12 text-gray-500">Loading scoreboards...</div>
              ) : scoreboards.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="mb-2">No scoreboards imported yet.</p>
                  <p className="text-sm">Click &quot;Import from Files&quot; to load scoreboard images.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {scoreboards.map((sb) => (
                    <div
                      key={sb.id}
                      onClick={() => {
                        setSelectedScoreboard(sb);
                        setActiveTab("customizer");
                      }}
                      className={`group bg-gray-50 rounded-lg overflow-hidden cursor-pointer transition hover:shadow-md hover:bg-gray-100 ${
                        selectedScoreboard?.id === sb.id ? "ring-2 ring-[#8B3A3A]" : ""
                      }`}
                    >
                      <div className="aspect-[4/3] bg-white p-2 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getImageUrl(sb.image_filename)}
                          alt={sb.model_name}
                          className="w-full h-full object-contain"
                        />
                        <span
                          className={`absolute top-2 right-2 px-1.5 py-0.5 text-[10px] font-medium rounded ${
                            sb.analysis_status === "completed"
                              ? "bg-green-500 text-white"
                              : sb.analysis_status === "error"
                              ? "bg-red-500 text-white"
                              : "bg-gray-300 text-gray-700"
                          }`}
                        >
                          {sb.analysis_status === "completed" ? "Done" : sb.analysis_status === "error" ? "Error" : "Pending"}
                        </span>
                      </div>
                      <div className="p-2 text-center">
                        <div className="font-semibold text-sm text-gray-900">{sb.model_name.toUpperCase()}</div>
                        {sb.sport_type && (
                          <div className="text-xs text-gray-500 capitalize">{sb.sport_type}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Customizer Tab */}
        {activeTab === "customizer" && (
          <div className="space-y-4">
            {selectedScoreboard ? (
              <>
                {/* Mode Toggle */}
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-gray-700">Preview Mode:</span>
                      <div className="flex rounded-lg overflow-hidden border border-gray-300">
                        <button
                          onClick={() => setUseGeneratedMode(false)}
                          className={`px-4 py-2 text-sm font-medium transition ${
                            !useGeneratedMode
                              ? "bg-[#8B3A3A] text-white"
                              : "bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          Live Preview
                        </button>
                        <button
                          onClick={() => setUseGeneratedMode(true)}
                          className={`px-4 py-2 text-sm font-medium transition ${
                            useGeneratedMode
                              ? "bg-[#8B3A3A] text-white"
                              : "bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          Generated Images
                        </button>
                      </div>
                    </div>
                    {useGeneratedMode && (
                      <div className="flex items-center gap-3">
                        {generationStatus && (
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            generationStatus === "ready" || generationStatus === "completed"
                              ? "bg-green-100 text-green-800"
                              : generationStatus === "generating"
                              ? "bg-blue-100 text-blue-800 animate-pulse"
                              : generationStatus === "error"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {generationStatus === "ready" ? "Ready" : generationStatus === "generating" ? "Generating..." : generationStatus}
                          </span>
                        )}
                        <button
                          onClick={handleGenerate}
                          disabled={generating}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition font-medium text-sm"
                        >
                          {generating ? "Creating..." : "Generate This"}
                        </button>
                        <button
                          onClick={handleGenerateAll}
                          disabled={generatingAll}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium text-sm"
                        >
                          {generatingAll ? "Queuing..." : "Generate All (684)"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Model Progress */}
                  {useGeneratedMode && modelProgress && modelProgress.totalTasks > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">Model Progress: {selectedScoreboard?.model_name}</span>
                        <span className="text-gray-500">
                          {modelProgress.completed} / {modelProgress.totalTasks} ({modelProgress.percentComplete}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${modelProgress.percentComplete}%` }}
                        />
                      </div>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span className="text-green-600">Completed: {modelProgress.completed}</span>
                        <span className="text-yellow-600">Pending: {modelProgress.pending}</span>
                        {modelProgress.processing > 0 && (
                          <span className="text-blue-600">Processing: {modelProgress.processing}</span>
                        )}
                      </div>
                      {modelProgress.pending > 0 && (
                        <a
                          href="/batch"
                          className="mt-2 inline-block text-sm text-blue-600 hover:underline"
                        >
                          Go to Batch Processing to start generation →
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Scoreboard Preview - Full Width */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex justify-center">
                    {useGeneratedMode ? (
                      generatedImageUrl ? (
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={generatedImageUrl}
                            alt={`${selectedScoreboard.model_name} - ${faceColor}/${accentColor}/${ledColor}`}
                            className="max-w-full h-auto"
                            style={{ maxHeight: "500px" }}
                          />
                          <div className="absolute top-2 right-2 px-2 py-1 bg-green-500 text-white text-xs rounded font-medium">
                            S3 Generated
                          </div>
                        </div>
                      ) : (
                        <div className="w-full max-w-2xl aspect-[16/9] bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-500">
                          {generationStatus === "generating" ? (
                            <div className="w-full max-w-md px-8">
                              {/* Progress circle */}
                              <div className="flex justify-center mb-6">
                                <div className="relative w-24 h-24">
                                  <svg className="w-24 h-24 transform -rotate-90">
                                    <circle
                                      cx="48"
                                      cy="48"
                                      r="40"
                                      fill="none"
                                      stroke="#e5e7eb"
                                      strokeWidth="8"
                                    />
                                    <circle
                                      cx="48"
                                      cy="48"
                                      r="40"
                                      fill="none"
                                      stroke="#3b82f6"
                                      strokeWidth="8"
                                      strokeLinecap="round"
                                      strokeDasharray={`${2 * Math.PI * 40}`}
                                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - progressPercent / 100)}`}
                                      className="transition-all duration-300"
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xl font-bold text-blue-600">{progressPercent}%</span>
                                  </div>
                                </div>
                              </div>

                              {/* Current step */}
                              <p className="text-lg font-medium text-gray-800 text-center mb-4">
                                {progressStep || "Initializing..."}
                              </p>

                              {/* Progress bar */}
                              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                                <div
                                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>

                              {/* Step indicators */}
                              <div className="flex justify-between text-xs text-gray-500 mb-2">
                                <span className={progressPercent >= 10 ? "text-blue-600 font-medium" : ""}>Cache</span>
                                <span className={progressPercent >= 30 ? "text-blue-600 font-medium" : ""}>Masks</span>
                                <span className={progressPercent >= 50 ? "text-blue-600 font-medium" : ""}>Colors</span>
                                <span className={progressPercent >= 75 ? "text-blue-600 font-medium" : ""}>Merge</span>
                                <span className={progressPercent >= 90 ? "text-blue-600 font-medium" : ""}>Upload</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-lg font-medium mb-2">No Generated Image</p>
                              <p className="text-sm text-center max-w-md">
                                Click &quot;Generate Image&quot; to create this color combination
                              </p>
                            </>
                          )}
                        </div>
                      )
                    ) : (
                      <ColorizedScoreboard
                        imageUrl={getImageUrl(selectedScoreboard.image_filename)}
                        faceColor={COLOR_PALETTE[faceColor] || "#1a1a2e"}
                        accentColor={accentColor !== "none" ? COLOR_PALETTE[accentColor] : null}
                        ledColor={LED_COLORS[ledColor] || "#ff0000"}
                        className=""
                      />
                    )}
                  </div>

                  {/* Color combination info */}
                  <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border border-gray-300"
                        style={{ backgroundColor: COLOR_PALETTE[faceColor] }}
                      />
                      <span className="text-gray-600">Face: <strong>{COLOR_DISPLAY_NAMES[faceColor]}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded border border-gray-300 ${accentColor === "none" ? "bg-white relative overflow-hidden" : ""}`}
                        style={{ backgroundColor: accentColor !== "none" ? COLOR_PALETTE[accentColor] : undefined }}
                      >
                        {accentColor === "none" && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-full h-0.5 bg-red-500 rotate-45" />
                          </div>
                        )}
                      </div>
                      <span className="text-gray-600">Accent: <strong>{COLOR_DISPLAY_NAMES[accentColor]}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border border-gray-300"
                        style={{ backgroundColor: LED_COLORS[ledColor] }}
                      />
                      <span className="text-gray-600">LED: <strong>{ledColor.charAt(0).toUpperCase() + ledColor.slice(1)}</strong></span>
                    </div>
                  </div>

                  {/* ETN Upgrade Option */}
                  <label className="flex items-center gap-2 mt-4 cursor-pointer justify-center">
                    <input
                      type="checkbox"
                      checked={upgradeETN}
                      onChange={(e) => setUpgradeETN(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-[#8B3A3A] focus:ring-[#8B3A3A]"
                    />
                    <span className="text-sm text-gray-700">Upgrade to Electronic Team Names (ETNs)</span>
                  </label>
                </div>

                {/* Choose Colors Section */}
                <div className="bg-[#e5e5e5] rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">Choose Colors:</h3>

                  {/* Color Category Tabs - Styled like reference */}
                  <div className="flex mb-6">
                    <button
                      onClick={() => setColorTab("face")}
                      className={`px-6 py-3 font-semibold text-white transition ${
                        colorTab === "face" ? "bg-[#8B3A3A]" : "bg-[#a85858]"
                      }`}
                    >
                      Scoreboard Face
                    </button>
                    <button
                      onClick={() => setColorTab("accent")}
                      className={`px-6 py-3 font-semibold text-white transition ${
                        colorTab === "accent" ? "bg-[#8B3A3A]" : "bg-[#a85858]"
                      }`}
                    >
                      Accent Striping
                    </button>
                    <button
                      onClick={() => setColorTab("led")}
                      className={`px-6 py-3 font-semibold text-white transition ${
                        colorTab === "led" ? "bg-[#8B3A3A]" : "bg-[#a85858]"
                      }`}
                    >
                      LED Color
                    </button>
                  </div>

                  {/* Color Swatches and Selection Info */}
                  <div className="flex items-start gap-8">
                    <div className="flex-1">
                      {colorTab === "led" ? (
                        <div className="flex gap-2">
                          {Object.entries(LED_COLORS).map(([name, rgb]) => (
                            <button
                              key={name}
                              onClick={() => applyColorSelection(name)}
                              title={name.charAt(0).toUpperCase() + name.slice(1)}
                              className={`w-14 h-14 rounded-lg transition ${
                                ledColor === name
                                  ? "ring-2 ring-offset-2 ring-[#8B3A3A]"
                                  : "hover:scale-105"
                              }`}
                              style={{ backgroundColor: rgb }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div>
                          {/* Row 1: First 9 colors */}
                          <div className="flex gap-2 mb-2">
                            {COLOR_ORDER.slice(0, 9).map((name) => (
                              <button
                                key={name}
                                onClick={() => applyColorSelection(name)}
                                title={COLOR_DISPLAY_NAMES[name]}
                                className={`w-14 h-14 rounded-lg transition ${
                                  getCurrentColor() === name
                                    ? "ring-2 ring-offset-2 ring-[#8B3A3A]"
                                    : "hover:scale-105"
                                } ${name === "white" ? "border border-gray-400" : ""}`}
                                style={{ backgroundColor: COLOR_PALETTE[name] }}
                              />
                            ))}
                          </div>
                          {/* Row 2: Remaining colors */}
                          <div className="flex gap-2 mb-2">
                            {COLOR_ORDER.slice(9).map((name) => (
                              <button
                                key={name}
                                onClick={() => applyColorSelection(name)}
                                title={COLOR_DISPLAY_NAMES[name]}
                                className={`w-14 h-14 rounded-lg transition ${
                                  getCurrentColor() === name
                                    ? "ring-2 ring-offset-2 ring-[#8B3A3A]"
                                    : "hover:scale-105"
                                } ${name === "white" ? "border border-gray-400" : ""}`}
                                style={{ backgroundColor: COLOR_PALETTE[name] }}
                              />
                            ))}
                          </div>
                          {/* None option for accent */}
                          {colorTab === "accent" && (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => applyColorSelection("none")}
                                title="None"
                                className={`w-14 h-14 rounded-lg transition bg-white border border-gray-300 flex items-center justify-center ${
                                  accentColor === "none"
                                    ? "ring-2 ring-offset-2 ring-[#8B3A3A]"
                                    : "hover:scale-105"
                                }`}
                              >
                                <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="4" y1="20" x2="20" y2="4" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Currently Showing / New Selection */}
                    <div className="text-right">
                      <div className="mb-2">
                        <span className="text-gray-600 font-medium">Currently Showing: </span>
                        <span className="font-semibold text-gray-900">
                          {COLOR_DISPLAY_NAMES[getCurrentColor()] || getCurrentColor()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 font-medium">New Selection: </span>
                        <span className="font-semibold text-gray-900">
                          {COLOR_DISPLAY_NAMES[getCurrentColor()] || getCurrentColor()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Export Configuration */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Export Configuration</h3>
                      <p className="text-sm text-gray-500 mt-1">Save your customization as JSON</p>
                    </div>
                    <button
                      onClick={() => {
                        const config = {
                          model: selectedScoreboard.model_name,
                          sport_type: selectedScoreboard.sport_type,
                          layout_type: selectedScoreboard.layout_type,
                          face_color: faceColor,
                          face_color_rgb: COLOR_PALETTE[faceColor],
                          accent_color: accentColor,
                          accent_color_rgb: accentColor !== "none" ? COLOR_PALETTE[accentColor] : null,
                          led_color: ledColor,
                          led_color_rgb: LED_COLORS[ledColor],
                          upgrade_etn: upgradeETN,
                          zones: selectedScoreboard.zones,
                          features: selectedScoreboard.features,
                        };
                        navigator.clipboard.writeText(JSON.stringify(config, null, 2));
                        setMessage({ type: "success", text: "Configuration copied to clipboard!" });
                      }}
                      className="px-6 py-2 bg-[#1a1a2e] text-white rounded-lg hover:bg-[#2a2a3e] transition font-medium"
                    >
                      Copy JSON
                    </button>
                  </div>
                </div>

                {/* Detected Zones */}
                {selectedScoreboard.zones && selectedScoreboard.zones.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Detected Display Zones (AI Analysis)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {selectedScoreboard.zones.map((zone) => (
                        <div key={zone.zone_id} className="bg-gray-50 p-3 rounded-lg">
                          <div className="font-medium text-sm text-gray-900">{zone.zone_id.replace(/_/g, " ")}</div>
                          <div className="text-xs text-gray-500">{zone.zone_type.replace(/_/g, " ")}</div>
                          {zone.label && (
                            <div className="text-xs text-[#8B3A3A] mt-1">Label: {zone.label}</div>
                          )}
                          {zone.digit_count && (
                            <div className="text-xs text-gray-500">{zone.digit_count} digits</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Scoreboard Selected</h3>
                  <p className="text-gray-500 mb-6">Choose a scoreboard from the library to start customizing</p>
                  <button
                    onClick={() => setActiveTab("scoreboards")}
                    className="px-6 py-2 bg-[#8B3A3A] text-white rounded-lg hover:bg-[#6B2A2A] transition font-medium"
                  >
                    Browse Library
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Analysis Status Tab */}
        {activeTab === "analysis" && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="text-3xl font-bold text-gray-900">{scoreboards.length}</div>
                <div className="text-gray-500 text-sm mt-1">Total Models</div>
              </div>
              <div className="bg-yellow-50 rounded-xl shadow-sm p-6 text-center border border-yellow-100">
                <div className="text-3xl font-bold text-yellow-600">{statusCounts.pending || 0}</div>
                <div className="text-gray-500 text-sm mt-1">Pending</div>
              </div>
              <div className="bg-green-50 rounded-xl shadow-sm p-6 text-center border border-green-100">
                <div className="text-3xl font-bold text-green-600">{statusCounts.completed || 0}</div>
                <div className="text-gray-500 text-sm mt-1">Completed</div>
              </div>
              <div className="bg-red-50 rounded-xl shadow-sm p-6 text-center border border-red-100">
                <div className="text-3xl font-bold text-red-600">{statusCounts.error || 0}</div>
                <div className="text-gray-500 text-sm mt-1">Errors</div>
              </div>
            </div>

            {/* Progress */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-gray-700">Analysis Progress</span>
                <span className="text-gray-500">
                  {scoreboards.length > 0
                    ? Math.round(((statusCounts.completed || 0) / scoreboards.length) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{
                    width: `${
                      scoreboards.length > 0
                        ? ((statusCounts.completed || 0) / scoreboards.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Sport Type Breakdown */}
            {statusCounts.completed && statusCounts.completed > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">By Sport Type</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {Array.from(
                    new Set(
                      scoreboards
                        .filter((sb) => sb.sport_type)
                        .map((sb) => sb.sport_type)
                    )
                  ).map((sport) => (
                    <div key={sport} className="bg-gray-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-[#8B3A3A]">
                        {scoreboards.filter((sb) => sb.sport_type === sport).length}
                      </div>
                      <div className="text-sm text-gray-500 capitalize">{sport}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
