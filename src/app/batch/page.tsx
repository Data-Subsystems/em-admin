"use client";

import { useState, useEffect, useCallback } from "react";

const S3_BASE_URL = "https://em-admin-assets.s3.us-east-1.amazonaws.com";

interface BatchStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  processing: number;
  percentComplete: number;
}

interface ModelProgress {
  model: string;
  total: number;
  completed: number;
  failed: number;
  pending: number;
  percentComplete: number;
}

interface CompletedTask {
  id: string;
  model: string;
  primary_color: string;
  accent_color: string;
  led_color: string;
  s3_key: string;
  completed_at: string;
}

interface Batch {
  id: string;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  images_per_second: number;
  total_duration_seconds: number;
  created_at: string;
}

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
  none: "None",
  red: "Red",
  amber: "Amber",
};

export default function BatchProcessingPage() {
  const [stats, setStats] = useState<BatchStats | null>(null);
  const [models, setModels] = useState<ModelProgress[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal state
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelImages, setModelImages] = useState<CompletedTask[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);

  // Filter state
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "in-progress" | "pending">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch batch status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/colorpicker/batch");
      const data = await response.json();
      setStats(data.stats);
      setModels(data.models || []);
      setBatches(data.batches || []);
    } catch (error) {
      console.error("Error fetching batch status:", error);
    }
    setLoading(false);
  }, []);

  // Fetch images for a model
  const fetchModelImages = async (model: string) => {
    setLoadingImages(true);
    try {
      const response = await fetch(`/api/colorpicker/batch?model=${encodeURIComponent(model)}`);
      const data = await response.json();
      setModelImages(data.tasks || []);
    } catch (error) {
      console.error("Error fetching model images:", error);
    }
    setLoadingImages(false);
  };

  // Stop batch processing
  const handleStop = async () => {
    setStopping(true);
    try {
      const response = await fetch("/api/colorpicker/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: "success", text: data.message });
        fetchStatus();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to stop" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to stop batch processing" });
    }
    setStopping(false);
  };

  // Reset failed tasks
  const handleResetFailed = async () => {
    try {
      const response = await fetch("/api/colorpicker/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-failed" }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: "success", text: data.message });
        fetchStatus();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to reset" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to reset failed tasks" });
    }
  };

  // Open model modal
  const openModelModal = (model: string) => {
    setSelectedModel(model);
    fetchModelImages(model);
  };

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStatus]);

  // Filter models
  const filteredModels = models.filter((m) => {
    // Search filter
    if (searchQuery && !m.model.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Status filter
    if (filterStatus === "completed" && m.percentComplete < 100) return false;
    if (filterStatus === "in-progress" && (m.percentComplete === 0 || m.percentComplete === 100)) return false;
    if (filterStatus === "pending" && m.percentComplete > 0) return false;
    return true;
  });

  const isProcessing = (stats?.processing || 0) > 0;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-[#1a1a2e] text-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-3 hover:opacity-80 transition">
              <div className="w-10 h-10 bg-[#8B3A3A] rounded-lg flex items-center justify-center font-bold text-lg">
                EM
              </div>
              <div>
                <h1 className="text-xl font-semibold">Batch Processing</h1>
                <p className="text-gray-400 text-xs">ColorPicker Image Generation</p>
              </div>
            </a>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh
            </label>
            {isProcessing && (
              <button
                onClick={handleStop}
                disabled={stopping}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition font-medium text-sm flex items-center gap-2"
              >
                {stopping ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Stopping...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Stop Processing
                  </>
                )}
              </button>
            )}
            <a href="/" className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded transition">
              Back to Customizer
            </a>
          </div>
        </div>
      </header>

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
            <button onClick={() => setMessage(null)} className="text-lg font-bold hover:opacity-70">
              ×
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <StatCard title="Total Tasks" value={(stats?.total || 0).toLocaleString()} />
              <StatCard title="Completed" value={(stats?.completed || 0).toLocaleString()} color="green" />
              <StatCard title="Failed" value={(stats?.failed || 0).toLocaleString()} color="red" />
              <StatCard title="Pending" value={(stats?.pending || 0).toLocaleString()} color="yellow" />
              <StatCard
                title="Processing"
                value={(stats?.processing || 0).toLocaleString()}
                color="blue"
                pulse={isProcessing}
              />
              <StatCard title="Progress" value={`${stats?.percentComplete || 0}%`} />
            </div>

            {/* Progress Bar */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span className="font-medium">Overall Progress</span>
                <span>
                  {(stats?.completed || 0).toLocaleString()} / {(stats?.total || 0).toLocaleString()} images
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-600 h-6 rounded-full transition-all duration-500 flex items-center justify-center"
                  style={{ width: `${Math.max(stats?.percentComplete || 0, 1)}%` }}
                >
                  {(stats?.percentComplete || 0) > 10 && (
                    <span className="text-white text-sm font-medium">{stats?.percentComplete}%</span>
                  )}
                </div>
              </div>
              {isProcessing && (
                <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing {stats?.processing} tasks...
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              {(stats?.failed || 0) > 0 && (
                <button
                  onClick={handleResetFailed}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition font-medium text-sm"
                >
                  Reset {stats?.failed} Failed Tasks
                </button>
              )}
            </div>

            {/* Models Grid */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b flex items-center justify-between flex-wrap gap-4">
                <h2 className="text-lg font-semibold">Model Progress</h2>
                <div className="flex items-center gap-4">
                  {/* Search */}
                  <input
                    type="text"
                    placeholder="Search models..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-3 py-1.5 border rounded-lg text-sm w-48"
                  />
                  {/* Filter */}
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                    className="px-3 py-1.5 border rounded-lg text-sm"
                  >
                    <option value="all">All ({models.length})</option>
                    <option value="completed">Completed ({models.filter((m) => m.percentComplete === 100).length})</option>
                    <option value="in-progress">In Progress ({models.filter((m) => m.percentComplete > 0 && m.percentComplete < 100).length})</option>
                    <option value="pending">Not Started ({models.filter((m) => m.percentComplete === 0).length})</option>
                  </select>
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredModels.slice(0, 100).map((m) => (
                    <div
                      key={m.model}
                      onClick={() => m.completed > 0 && openModelModal(m.model)}
                      className={`p-4 rounded-lg border transition ${
                        m.completed > 0
                          ? "cursor-pointer hover:shadow-md hover:border-blue-300 bg-white"
                          : "bg-gray-50 cursor-default"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono text-sm font-medium">{m.model}</span>
                        {m.percentComplete === 100 && (
                          <span className="text-green-500">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-gray-200 rounded h-2 mb-2">
                        <div
                          className={`h-2 rounded transition-all ${
                            m.percentComplete === 100
                              ? "bg-green-500"
                              : m.percentComplete > 0
                              ? "bg-blue-500"
                              : "bg-gray-300"
                          }`}
                          style={{ width: `${m.percentComplete}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>
                          {m.completed}/{m.total}
                        </span>
                        <span>{m.percentComplete}%</span>
                      </div>
                      {m.failed > 0 && (
                        <div className="text-xs text-red-500 mt-1">{m.failed} failed</div>
                      )}
                    </div>
                  ))}
                </div>
                {filteredModels.length > 100 && (
                  <p className="text-center text-gray-500 mt-4">
                    Showing 100 of {filteredModels.length} models
                  </p>
                )}
                {filteredModels.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No models match your filter</p>
                )}
              </div>
            </div>

            {/* Recent Batches */}
            {batches.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-semibold">Recent Batches</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">ID</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Completed</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Failed</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Rate</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {batches.map((batch) => (
                        <tr key={batch.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-sm">{batch.id.slice(0, 8)}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={batch.status} />
                          </td>
                          <td className="px-4 py-3 text-right">{batch.completed_tasks?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-red-600">{batch.failed_tasks}</td>
                          <td className="px-4 py-3 text-right">{batch.images_per_second?.toFixed(1)} img/s</td>
                          <td className="px-4 py-3 text-right">{formatDuration(batch.total_duration_seconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CLI Commands */}
            <div className="bg-gray-900 text-gray-100 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">CLI Commands</h2>
              <div className="space-y-3 font-mono text-sm">
                <div>
                  <span className="text-gray-400"># Discover models from S3</span>
                  <br />
                  modal run modal_functions/colorpicker_batch.py --action discover
                </div>
                <div>
                  <span className="text-gray-400"># Populate tasks table</span>
                  <br />
                  modal run modal_functions/colorpicker_batch.py --action populate
                </div>
                <div>
                  <span className="text-gray-400"># Run batch processing (test with limit)</span>
                  <br />
                  modal run modal_functions/colorpicker_batch.py --action run --max-tasks 100
                </div>
                <div>
                  <span className="text-gray-400"># Run full batch processing</span>
                  <br />
                  modal run modal_functions/colorpicker_batch.py --action run --batch-size 100 --max-parallel 90
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Modal for viewing model images */}
      {selectedModel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-xl font-semibold">{selectedModel}</h3>
                <p className="text-sm text-gray-500">
                  {modelImages.length} generated images
                </p>
              </div>
              <button
                onClick={() => setSelectedModel(null)}
                className="p-2 hover:bg-gray-200 rounded-lg transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingImages ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : modelImages.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No generated images found for this model.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {modelImages.map((task) => (
                    <div key={task.id} className="group">
                      <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`${S3_BASE_URL}/${task.s3_key}`}
                          alt={`${task.primary_color}/${task.accent_color}/${task.led_color}`}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                        <a
                          href={`${S3_BASE_URL}/${task.s3_key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg opacity-0 group-hover:opacity-100 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                      <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Face:</span>
                          <span>{COLOR_DISPLAY_NAMES[task.primary_color] || task.primary_color}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Accent:</span>
                          <span>{COLOR_DISPLAY_NAMES[task.accent_color] || task.accent_color}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">LED:</span>
                          <span>{COLOR_DISPLAY_NAMES[task.led_color] || task.led_color}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
  pulse,
}: {
  title: string;
  value: string;
  color?: "green" | "red" | "yellow" | "blue";
  pulse?: boolean;
}) {
  const colorClasses = {
    green: "text-green-600",
    red: "text-red-600",
    yellow: "text-yellow-600",
    blue: "text-blue-600",
  };
  return (
    <div className={`bg-white rounded-lg shadow p-4 ${pulse ? "ring-2 ring-blue-400 ring-opacity-50" : ""}`}>
      <div className="text-sm text-gray-500 mb-1">{title}</div>
      <div className={`text-2xl font-bold ${color ? colorClasses[color] : "text-gray-900"} ${pulse ? "animate-pulse" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    stopped: "bg-yellow-100 text-yellow-800",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
