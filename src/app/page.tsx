"use client";

import { useState, useEffect, useCallback } from "react";
import { ScoreboardModel, COLOR_PALETTE, LED_COLORS } from "@/lib/supabase";
import ColorizedScoreboard from "@/components/ColorizedScoreboard";

type Tab = "scoreboards" | "customizer" | "analysis";
type ColorTab = "face" | "accent" | "led";

interface StatusCounts {
  pending?: number;
  processing?: number;
  completed?: number;
  error?: number;
}

const S3_BASE_URL = "https://em-admin-assets.s3.us-east-1.amazonaws.com/images";

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

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("scoreboards");
  const [scoreboards, setScoreboards] = useState<ScoreboardModel[]>([]);
  const [selectedScoreboard, setSelectedScoreboard] = useState<ScoreboardModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Customization state
  const [colorTab, setColorTab] = useState<ColorTab>("face");
  const [faceColor, setFaceColor] = useState<string>("matte_black");
  const [accentColor, setAccentColor] = useState<string>("none");
  const [ledColor, setLedColor] = useState<string>("red");
  const [upgradeETN, setUpgradeETN] = useState(false);

  // Restore state from localStorage on mount
  useEffect(() => {
    const savedTab = localStorage.getItem(STORAGE_KEYS.activeTab) as Tab | null;
    const savedColorTab = localStorage.getItem(STORAGE_KEYS.colorTab) as ColorTab | null;
    const savedFace = localStorage.getItem(STORAGE_KEYS.faceColor);
    const savedAccent = localStorage.getItem(STORAGE_KEYS.accentColor);
    const savedLed = localStorage.getItem(STORAGE_KEYS.ledColor);
    const savedETN = localStorage.getItem(STORAGE_KEYS.upgradeETN);

    if (savedTab) setActiveTab(savedTab);
    if (savedColorTab) setColorTab(savedColorTab);
    if (savedFace) setFaceColor(savedFace);
    if (savedAccent) setAccentColor(savedAccent);
    if (savedLed) setLedColor(savedLed);
    if (savedETN) setUpgradeETN(savedETN === "true");

    setInitialized(true);
  }, []);

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

  // Get image URL
  const getImageUrl = (filename: string) => {
    return `${S3_BASE_URL}/${filename}`;
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
  };

  useEffect(() => {
    fetchScoreboards();
    fetchAnalysisStatus();
  }, [fetchScoreboards, fetchAnalysisStatus]);

  // Restore selected scoreboard after data loads
  useEffect(() => {
    if (scoreboards.length > 0 && !selectedScoreboard && initialized) {
      const savedId = localStorage.getItem(STORAGE_KEYS.selectedId);
      if (savedId) {
        const saved = scoreboards.find((s) => s.id === savedId);
        if (saved) setSelectedScoreboard(saved);
      }
    }
  }, [scoreboards, selectedScoreboard, initialized]);

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
          <div className="space-y-6">
            {selectedScoreboard ? (
              <>
                {/* Model Header */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        Model {selectedScoreboard.model_name.toUpperCase()}
                      </h2>
                      <p className="text-gray-500 mt-1">
                        {selectedScoreboard.sport_type
                          ? `${selectedScoreboard.sport_type.charAt(0).toUpperCase() + selectedScoreboard.sport_type.slice(1)} Scoreboard`
                          : "Multi-Sport Scoreboard"}
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("scoreboards")}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Change Model
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Scoreboard Preview */}
                  <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
                    {/* Canvas-based colorized preview */}
                    <div className="bg-gray-900 rounded-lg p-6 min-h-[350px] flex items-center justify-center">
                      <ColorizedScoreboard
                        imageUrl={getImageUrl(selectedScoreboard.image_filename)}
                        faceColor={COLOR_PALETTE[faceColor] || "#1a1a2e"}
                        accentColor={accentColor !== "none" ? COLOR_PALETTE[accentColor] : null}
                        ledColor={LED_COLORS[ledColor] || "#ff0000"}
                        className="max-h-[350px]"
                      />
                    </div>

                    {/* Color Preview Summary */}
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Current Configuration</div>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-lg shadow-sm border border-gray-200"
                            style={{ backgroundColor: COLOR_PALETTE[faceColor] }}
                          />
                          <div>
                            <div className="text-xs text-gray-500">Face</div>
                            <div className="text-sm font-medium text-gray-900">{COLOR_DISPLAY_NAMES[faceColor]}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-8 h-8 rounded-lg shadow-sm ${accentColor === "none" ? "border-2 border-dashed border-gray-300" : "border border-gray-200"}`}
                            style={{ backgroundColor: accentColor !== "none" ? COLOR_PALETTE[accentColor] : "transparent" }}
                          />
                          <div>
                            <div className="text-xs text-gray-500">Accent</div>
                            <div className="text-sm font-medium text-gray-900">{COLOR_DISPLAY_NAMES[accentColor]}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-lg shadow-sm border border-gray-200"
                            style={{ backgroundColor: LED_COLORS[ledColor], boxShadow: `0 0 10px ${LED_COLORS[ledColor]}` }}
                          />
                          <div>
                            <div className="text-xs text-gray-500">LED</div>
                            <div className="text-sm font-medium text-gray-900">{COLOR_DISPLAY_NAMES[ledColor] || ledColor.charAt(0).toUpperCase() + ledColor.slice(1)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ETN Upgrade Option */}
                    <label className="flex items-center gap-3 mt-4 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                      <input
                        type="checkbox"
                        checked={upgradeETN}
                        onChange={(e) => setUpgradeETN(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-[#8B3A3A] focus:ring-[#8B3A3A]"
                      />
                      <div>
                        <span className="font-medium text-gray-900">Upgrade to Electronic Team Names (ETNs)</span>
                        <p className="text-xs text-gray-500">Display team names digitally instead of vinyl lettering</p>
                      </div>
                    </label>
                  </div>

                  {/* Specs & Actions Panel */}
                  <div className="space-y-6">
                    {/* Specifications */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                      <h3 className="font-semibold text-gray-900 mb-4">Specifications</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Dimensions</span>
                          <span className="font-medium text-gray-900">{selectedScoreboard.dimensions || "Contact for specs"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Sport Type</span>
                          <span className="font-medium text-gray-900 capitalize">{selectedScoreboard.sport_type || "Multi-sport"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Layout</span>
                          <span className="font-medium text-gray-900">{selectedScoreboard.layout_type?.replace(/_/g, " ") || "Standard"}</span>
                        </div>
                        {selectedScoreboard.zones && selectedScoreboard.zones.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Display Zones</span>
                            <span className="font-medium text-gray-900">{selectedScoreboard.zones.length}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="bg-white rounded-xl shadow-sm p-6 space-y-3">
                      {selectedScoreboard.analysis_status === "pending" && (
                        <button
                          onClick={() => handleAnalyzeSingle(selectedScoreboard.id)}
                          disabled={analyzing}
                          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
                        >
                          {analyzing ? "Analyzing..." : "Analyze with AI"}
                        </button>
                      )}
                      <button className="w-full px-4 py-3 bg-[#8B3A3A] text-white rounded-lg hover:bg-[#6B2A2A] transition font-medium">
                        Request a Quote
                      </button>
                      <button className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">
                        Print Specifications
                      </button>
                    </div>
                  </div>
                </div>

                {/* Color Selection Panel */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Color Configuration</h3>

                  {/* Color Category Tabs */}
                  <div className="flex gap-2 mb-6">
                    {[
                      { id: "face", label: "Face Color" },
                      { id: "accent", label: "Accent Stripe" },
                      { id: "led", label: "LED Color" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setColorTab(tab.id as ColorTab)}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                          colorTab === tab.id
                            ? "bg-[#1a1a2e] text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Color Swatches */}
                  <div className="flex items-start gap-8">
                    <div className="flex-1">
                      {colorTab === "led" ? (
                        <div className="flex gap-3">
                          {Object.entries(LED_COLORS).map(([name, rgb]) => (
                            <button
                              key={name}
                              onClick={() => applyColorSelection(name)}
                              title={name.charAt(0).toUpperCase() + name.slice(1)}
                              className={`w-12 h-12 rounded-lg transition shadow-sm ${
                                ledColor === name
                                  ? "ring-2 ring-offset-2 ring-[#8B3A3A] scale-110"
                                  : "hover:scale-105"
                              }`}
                              style={{ backgroundColor: rgb }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-9 gap-2">
                          {COLOR_ORDER.map((name) => (
                            <button
                              key={name}
                              onClick={() => applyColorSelection(name)}
                              title={COLOR_DISPLAY_NAMES[name]}
                              className={`w-10 h-10 rounded-lg transition shadow-sm ${
                                getCurrentColor() === name
                                  ? "ring-2 ring-offset-2 ring-[#8B3A3A] scale-110"
                                  : "hover:scale-105"
                              } ${name === "white" ? "border border-gray-300" : ""}`}
                              style={{ backgroundColor: COLOR_PALETTE[name] }}
                            />
                          ))}
                          {colorTab === "accent" && (
                            <button
                              onClick={() => applyColorSelection("none")}
                              title="None"
                              className={`w-10 h-10 rounded-lg transition border-2 border-gray-300 shadow-sm flex items-center justify-center ${
                                accentColor === "none"
                                  ? "ring-2 ring-offset-2 ring-[#8B3A3A] scale-110"
                                  : "hover:scale-105"
                              }`}
                            >
                              <span className="text-gray-400 text-xs font-medium">None</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Current Selection */}
                    <div className="w-48 bg-gray-50 rounded-lg p-4">
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Selected</div>
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg shadow-sm ${getCurrentColor() === "white" || getCurrentColor() === "none" ? "border border-gray-300" : ""}`}
                          style={{
                            backgroundColor: colorTab === "led"
                              ? LED_COLORS[getCurrentColor()]
                              : getCurrentColor() === "none"
                                ? "#f5f5f5"
                                : COLOR_PALETTE[getCurrentColor()]
                          }}
                        />
                        <span className="font-medium text-gray-900">
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
