"use client";

import { useState, useEffect, useCallback } from "react";
import { ScoreboardModel, COLOR_PALETTE, LED_COLORS } from "@/lib/supabase";

type Tab = "viewer" | "scoreboards" | "customizer" | "analysis";
type ColorTab = "face" | "accent" | "led";

interface S3Image {
  key: string;
  filename: string;
  modelName: string;
  url: string;
  size: number;
  lastModified: string;
}

interface StatusCounts {
  pending?: number;
  processing?: number;
  completed?: number;
  error?: number;
}

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

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("viewer");
  const [scoreboards, setScoreboards] = useState<ScoreboardModel[]>([]);
  const [selectedScoreboard, setSelectedScoreboard] = useState<ScoreboardModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // S3 Images state
  const [s3Images, setS3Images] = useState<S3Image[]>([]);
  const [s3Loading, setS3Loading] = useState(false);
  const [selectedS3Image, setSelectedS3Image] = useState<S3Image | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Customization state
  const [colorTab, setColorTab] = useState<ColorTab>("face");
  const [faceColor, setFaceColor] = useState<string>("indigo_purple");
  const [accentColor, setAccentColor] = useState<string>("white");
  const [ledColor, setLedColor] = useState<string>("red");
  const [newSelection, setNewSelection] = useState<string | null>(null);
  const [upgradeETN, setUpgradeETN] = useState(false);

  // Fetch S3 images
  const fetchS3Images = useCallback(async () => {
    setS3Loading(true);
    try {
      const response = await fetch("/api/images");
      const data = await response.json();
      if (data.images) {
        setS3Images(data.images);
      }
    } catch (error) {
      console.error("Error fetching S3 images:", error);
    }
    setS3Loading(false);
  }, []);

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
    setNewSelection(color);
    if (colorTab === "face") {
      setFaceColor(color);
    } else if (colorTab === "accent") {
      setAccentColor(color);
    } else {
      setLedColor(color);
    }
  };

  useEffect(() => {
    fetchS3Images();
    fetchScoreboards();
    fetchAnalysisStatus();
  }, [fetchS3Images, fetchScoreboards, fetchAnalysisStatus]);

  // Filter S3 images based on search
  const filteredS3Images = s3Images.filter((img) =>
    img.modelName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get current color for display
  const getCurrentColor = () => {
    if (colorTab === "face") return faceColor;
    if (colorTab === "accent") return accentColor;
    return ledColor;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 mt-4">
        <div className="border-b border-gray-200 bg-white rounded-t-lg">
          <nav className="flex">
            {[
              { id: "viewer", label: "Scoreboard Viewer" },
              { id: "scoreboards", label: "Scoreboards Library" },
              { id: "customizer", label: "Customizer" },
              { id: "analysis", label: "Analysis Status" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition ${
                  activeTab === tab.id
                    ? "border-[#8B3A3A] text-[#8B3A3A] bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-700"
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
            className={`p-4 rounded ${
              message.type === "success"
                ? "bg-green-100 text-green-800 border border-green-200"
                : "bg-red-100 text-red-800 border border-red-200"
            }`}
          >
            {message.text}
            <button
              onClick={() => setMessage(null)}
              className="float-right font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Scoreboard Viewer Tab */}
        {activeTab === "viewer" && (
          <div className="bg-white rounded-lg shadow">
            {/* Search and Stats */}
            <div className="p-4 border-b flex items-center justify-between gap-4">
              <div className="flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Search scoreboards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B3A3A]"
                />
              </div>
              <div className="text-gray-600">
                {s3Loading ? "Loading..." : `${filteredS3Images.length} of ${s3Images.length} images`}
              </div>
            </div>

            {/* Two-column layout */}
            <div className="flex">
              {/* Image Grid */}
              <div className="flex-1 p-4 border-r overflow-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
                {s3Loading ? (
                  <div className="text-center py-8">Loading images from S3...</div>
                ) : filteredS3Images.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {searchQuery ? "No matching scoreboards found" : "No images found in S3"}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredS3Images.map((img) => (
                      <div
                        key={img.key}
                        onClick={() => setSelectedS3Image(img)}
                        className={`cursor-pointer rounded border overflow-hidden transition hover:shadow-lg ${
                          selectedS3Image?.key === img.key ? "ring-2 ring-[#8B3A3A]" : ""
                        }`}
                      >
                        <div className="aspect-video bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt={img.modelName}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-2 bg-white">
                          <div className="font-medium text-sm text-center">{img.modelName.toUpperCase()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview Panel */}
              <div className="w-96 p-4 bg-gray-50" style={{ maxHeight: "calc(100vh - 200px)" }}>
                {selectedS3Image ? (
                  <div>
                    <h3 className="text-xl font-semibold text-[#8B3A3A] mb-4">
                      {selectedS3Image.modelName.toUpperCase()}
                    </h3>
                    <div className="bg-white rounded-lg border overflow-hidden mb-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedS3Image.url}
                        alt={selectedS3Image.modelName}
                        className="w-full h-auto"
                      />
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Filename:</span>{" "}
                        <span className="text-gray-600">{selectedS3Image.filename}</span>
                      </div>
                      <div>
                        <span className="font-medium">Size:</span>{" "}
                        <span className="text-gray-600">{(selectedS3Image.size / 1024).toFixed(1)} KB</span>
                      </div>
                      <div>
                        <span className="font-medium">S3 URL:</span>{" "}
                        <a
                          href={selectedS3Image.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          Open in new tab
                        </a>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedS3Image.url);
                        setMessage({ type: "success", text: "S3 URL copied to clipboard!" });
                      }}
                      className="mt-4 w-full px-4 py-2 bg-[#8B3A3A] text-white rounded hover:bg-[#6B2A2A] transition"
                    >
                      Copy S3 URL
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    Select an image to preview
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scoreboards Tab */}
        {activeTab === "scoreboards" && (
          <div className="bg-white rounded-lg shadow p-6">
            {/* Actions */}
            <div className="mb-6 flex gap-4 flex-wrap">
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-4 py-2 bg-[#8B3A3A] text-white rounded hover:bg-[#6B2A2A] disabled:opacity-50 transition"
              >
                {importing ? "Importing..." : "Import from Files"}
              </button>
              <button
                onClick={() => handleBatchAnalysis(10)}
                disabled={analyzing}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition"
              >
                {analyzing ? "Analyzing..." : "Analyze 10 Pending"}
              </button>
              <button
                onClick={() => handleBatchAnalysis(50)}
                disabled={analyzing}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition"
              >
                {analyzing ? "Analyzing..." : "Analyze 50 Pending"}
              </button>
            </div>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded border">
                <div className="text-2xl font-bold">{scoreboards.length}</div>
                <div className="text-gray-600 text-sm">Total Scoreboards</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-700">
                  {statusCounts.pending || 0}
                </div>
                <div className="text-gray-600 text-sm">Pending Analysis</div>
              </div>
              <div className="bg-green-50 p-4 rounded border border-green-200">
                <div className="text-2xl font-bold text-green-700">
                  {statusCounts.completed || 0}
                </div>
                <div className="text-gray-600 text-sm">Completed</div>
              </div>
              <div className="bg-red-50 p-4 rounded border border-red-200">
                <div className="text-2xl font-bold text-red-700">
                  {statusCounts.error || 0}
                </div>
                <div className="text-gray-600 text-sm">Errors</div>
              </div>
            </div>

            {/* Scoreboards Grid */}
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : scoreboards.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="mb-4">No scoreboards imported yet.</p>
                <p>Click &quot;Import from Files&quot; to load scoreboard images.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {scoreboards.map((sb) => (
                  <div
                    key={sb.id}
                    onClick={() => {
                      setSelectedScoreboard(sb);
                      setActiveTab("customizer");
                    }}
                    className={`bg-white rounded border overflow-hidden cursor-pointer hover:shadow-lg transition ${
                      selectedScoreboard?.id === sb.id ? "ring-2 ring-[#8B3A3A]" : ""
                    }`}
                  >
                    <div className="aspect-video bg-gray-100 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sb.image_url || `/scoreboards/${sb.image_filename}`}
                        alt={sb.model_name}
                        className="w-full h-full object-contain"
                      />
                      <span
                        className={`absolute top-1 right-1 px-1.5 py-0.5 text-xs rounded ${
                          sb.analysis_status === "completed"
                            ? "bg-green-500 text-white"
                            : sb.analysis_status === "error"
                            ? "bg-red-500 text-white"
                            : sb.analysis_status === "processing"
                            ? "bg-yellow-500 text-white"
                            : "bg-gray-400 text-white"
                        }`}
                      >
                        {sb.analysis_status}
                      </span>
                    </div>
                    <div className="p-2">
                      <div className="font-medium text-sm">{sb.model_name.toUpperCase()}</div>
                      {sb.sport_type && (
                        <div className="text-xs text-gray-500 capitalize">{sb.sport_type}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Customizer Tab - Matching Electro-Mech Style */}
        {activeTab === "customizer" && (
          <div className="bg-white rounded-lg shadow">
            {selectedScoreboard ? (
              <>
                {/* Model Title */}
                <div className="border-b px-6 py-4">
                  <h2 className="text-2xl font-semibold text-[#8B3A3A]">
                    Model {selectedScoreboard.model_name.toUpperCase()} {selectedScoreboard.sport_type ? `${selectedScoreboard.sport_type.charAt(0).toUpperCase() + selectedScoreboard.sport_type.slice(1)} Scoreboard` : "Scoreboard"}
                  </h2>
                  {selectedScoreboard.features && selectedScoreboard.features.length > 0 && (
                    <p className="text-gray-600 mt-2 text-sm">
                      Features: {selectedScoreboard.features.join(", ")}
                    </p>
                  )}
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Scoreboard Preview */}
                    <div className="lg:col-span-2">
                      <div
                        className="relative rounded-lg overflow-hidden border-4 border-white shadow-lg"
                        style={{ backgroundColor: COLOR_PALETTE[faceColor] || "#333" }}
                      >
                        {/* Accent stripe border effect */}
                        <div
                          className="absolute inset-0 border-8 pointer-events-none"
                          style={{ borderColor: accentColor !== "none" ? COLOR_PALETTE[accentColor] : "transparent" }}
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/scoreboards/${selectedScoreboard.image_filename}`}
                          alt={selectedScoreboard.model_name}
                          className="w-full h-auto relative z-10"
                          style={{
                            filter: `hue-rotate(0deg)`,
                            mixBlendMode: "luminosity"
                          }}
                        />
                        {/* Face color overlay */}
                        <div
                          className="absolute inset-0 z-20 mix-blend-multiply"
                          style={{ backgroundColor: COLOR_PALETTE[faceColor] || "transparent" }}
                        />
                        {/* LED glow effect */}
                        <div
                          className="absolute inset-0 z-30 mix-blend-screen opacity-30 pointer-events-none"
                          style={{
                            background: `radial-gradient(ellipse at center, ${LED_COLORS[ledColor] || "transparent"} 0%, transparent 70%)`
                          }}
                        />
                      </div>

                      {/* ETN Upgrade Option */}
                      <label className="flex items-center gap-2 mt-4 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={upgradeETN}
                          onChange={(e) => setUpgradeETN(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-gray-700">Upgrade to Electronic Team Names (ETNs)</span>
                      </label>
                    </div>

                    {/* Specs Panel */}
                    <div>
                      <div className="space-y-3 mb-6">
                        <div>
                          <span className="font-semibold">Dimensions:</span>{" "}
                          <span className="text-gray-700">{selectedScoreboard.dimensions || "Contact for specs"}</span>
                        </div>
                        <div>
                          <span className="font-semibold">Sport Type:</span>{" "}
                          <span className="text-gray-700 capitalize">{selectedScoreboard.sport_type || "Multi-sport"}</span>
                        </div>
                        <div>
                          <span className="font-semibold">Layout:</span>{" "}
                          <span className="text-gray-700">{selectedScoreboard.layout_type?.replace(/_/g, " ") || "Standard"}</span>
                        </div>
                        {selectedScoreboard.analysis_status === "completed" && selectedScoreboard.zones && (
                          <div>
                            <span className="font-semibold">Display Zones:</span>{" "}
                            <span className="text-gray-700">{selectedScoreboard.zones.length}</span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 mb-6">
                        <button className="flex-1 px-4 py-2 bg-[#C4A484] text-white rounded hover:bg-[#B4947A] transition font-medium">
                          Request a Quote
                        </button>
                        <button className="flex-1 px-4 py-2 bg-[#C4A484] text-white rounded hover:bg-[#B4947A] transition font-medium flex items-center justify-center gap-2">
                          <span>🖨</span> Print Scoreboard
                        </button>
                      </div>

                      {/* Analyze Button for Pending */}
                      {selectedScoreboard.analysis_status === "pending" && (
                        <button
                          onClick={() => handleAnalyzeSingle(selectedScoreboard.id)}
                          disabled={analyzing}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition mb-6"
                        >
                          {analyzing ? "Analyzing with Nova Lite..." : "Analyze with AI"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Color Selection Panel */}
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4">Choose Colors:</h3>

                    {/* Color Category Tabs */}
                    <div className="flex gap-1 mb-4">
                      <button
                        onClick={() => setColorTab("face")}
                        className={`px-6 py-2 font-medium rounded-t transition ${
                          colorTab === "face"
                            ? "bg-[#C4A484] text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        Scoreboard Face
                      </button>
                      <button
                        onClick={() => setColorTab("accent")}
                        className={`px-6 py-2 font-medium rounded-t transition ${
                          colorTab === "accent"
                            ? "bg-[#C4A484] text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        Accent Striping
                      </button>
                      <button
                        onClick={() => setColorTab("led")}
                        className={`px-6 py-2 font-medium rounded-t transition ${
                          colorTab === "led"
                            ? "bg-[#C4A484] text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        LED Color
                      </button>
                    </div>

                    {/* Color Swatches */}
                    <div className="bg-gray-100 p-4 rounded-lg">
                      <div className="flex flex-wrap gap-6">
                        {/* Color Grid */}
                        <div className="flex-1">
                          {colorTab === "led" ? (
                            // LED Colors - just Red and Amber
                            <div className="flex gap-2">
                              {Object.entries(LED_COLORS).map(([name, rgb]) => (
                                <button
                                  key={name}
                                  onClick={() => applyColorSelection(name)}
                                  title={name.charAt(0).toUpperCase() + name.slice(1)}
                                  className={`w-10 h-10 rounded transition ${
                                    ledColor === name
                                      ? "ring-2 ring-offset-2 ring-blue-500"
                                      : "hover:scale-110"
                                  }`}
                                  style={{ backgroundColor: rgb }}
                                />
                              ))}
                            </div>
                          ) : (
                            // Face/Accent Colors - grid layout
                            <div className="grid grid-cols-9 gap-2">
                              {COLOR_ORDER.map((name) => (
                                <button
                                  key={name}
                                  onClick={() => applyColorSelection(name)}
                                  title={COLOR_DISPLAY_NAMES[name]}
                                  className={`w-10 h-10 rounded transition ${
                                    getCurrentColor() === name
                                      ? "ring-2 ring-offset-2 ring-blue-500"
                                      : "hover:scale-110"
                                  } ${name === "white" ? "border border-gray-300" : ""}`}
                                  style={{ backgroundColor: COLOR_PALETTE[name] }}
                                />
                              ))}
                              {/* None option for accent striping */}
                              {colorTab === "accent" && (
                                <button
                                  onClick={() => applyColorSelection("none")}
                                  title="None"
                                  className={`w-10 h-10 rounded transition border border-gray-300 ${
                                    accentColor === "none"
                                      ? "ring-2 ring-offset-2 ring-blue-500"
                                      : "hover:scale-110"
                                  }`}
                                  style={{
                                    background: "linear-gradient(135deg, white 45%, red 45%, red 55%, white 55%)"
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Current/New Selection Display */}
                        <div className="w-64 space-y-2">
                          <div className="flex justify-between">
                            <span className="font-medium">Currently Showing:</span>
                            <span className="text-gray-700">
                              {COLOR_DISPLAY_NAMES[getCurrentColor()] || getCurrentColor()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">New Selection:</span>
                            <span className="text-gray-700">
                              {newSelection ? (COLOR_DISPLAY_NAMES[newSelection] || newSelection) : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Export Configuration */}
                  <div className="mt-6 pt-6 border-t">
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
                      className="px-6 py-2 bg-[#8B3A3A] text-white rounded hover:bg-[#6B2A2A] transition font-medium"
                    >
                      Export Configuration JSON
                    </button>
                  </div>

                  {/* Detected Zones */}
                  {selectedScoreboard.zones && selectedScoreboard.zones.length > 0 && (
                    <div className="mt-8 pt-6 border-t">
                      <h3 className="text-lg font-semibold mb-4">Detected Display Zones (AI Analysis)</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {selectedScoreboard.zones.map((zone) => (
                          <div key={zone.zone_id} className="bg-gray-50 p-3 rounded border">
                            <div className="font-medium text-sm">{zone.zone_id.replace(/_/g, " ")}</div>
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
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-gray-500">
                <p className="text-lg mb-4">Select a scoreboard from the library to customize</p>
                <button
                  onClick={() => setActiveTab("scoreboards")}
                  className="px-4 py-2 bg-[#8B3A3A] text-white rounded hover:bg-[#6B2A2A] transition"
                >
                  Browse Scoreboards
                </button>
              </div>
            )}
          </div>
        )}

        {/* Analysis Status Tab */}
        {activeTab === "analysis" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-6">Analysis Overview</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div className="text-center p-4 bg-gray-50 rounded">
                <div className="text-4xl font-bold">{scoreboards.length}</div>
                <div className="text-gray-600">Total</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded">
                <div className="text-4xl font-bold text-yellow-600">
                  {statusCounts.pending || 0}
                </div>
                <div className="text-gray-600">Pending</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded">
                <div className="text-4xl font-bold text-green-600">
                  {statusCounts.completed || 0}
                </div>
                <div className="text-gray-600">Completed</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded">
                <div className="text-4xl font-bold text-red-600">
                  {statusCounts.error || 0}
                </div>
                <div className="text-gray-600">Errors</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-8">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Analysis Progress</span>
                <span>
                  {scoreboards.length > 0
                    ? Math.round(((statusCounts.completed || 0) / scoreboards.length) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-green-600 h-4 rounded-full transition-all"
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
              <div>
                <h3 className="text-lg font-semibold mb-4">Sport Type Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {Array.from(
                    new Set(
                      scoreboards
                        .filter((sb) => sb.sport_type)
                        .map((sb) => sb.sport_type)
                    )
                  ).map((sport) => (
                    <div key={sport} className="bg-gray-50 p-3 rounded border text-center">
                      <div className="text-2xl font-bold text-[#8B3A3A]">
                        {scoreboards.filter((sb) => sb.sport_type === sport).length}
                      </div>
                      <div className="text-sm text-gray-600 capitalize">{sport}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-8 py-4 text-center text-gray-500 text-sm">
        Electro-Mech Scoreboard Image Tool • Built with Next.js + AWS Bedrock Nova Lite
      </footer>
    </div>
  );
}
