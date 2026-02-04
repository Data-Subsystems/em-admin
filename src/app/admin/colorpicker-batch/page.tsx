import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ColorPickerBatchPage() {
  const supabase = getSupabaseAdmin();

  // Get overall stats
  const { count: totalCount } = await supabase
    .from('colorpicker_tasks')
    .select('*', { count: 'exact', head: true });

  const { count: completedCount } = await supabase
    .from('colorpicker_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed');

  const { count: failedCount } = await supabase
    .from('colorpicker_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed');

  const { count: pendingCount } = await supabase
    .from('colorpicker_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: processingCount } = await supabase
    .from('colorpicker_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'processing');

  const percentComplete = totalCount
    ? Math.round(((completedCount || 0) / totalCount) * 100 * 100) / 100
    : 0;

  // Get per-model progress
  const { data: modelStats } = await supabase
    .from('colorpicker_tasks')
    .select('model, status')
    .limit(10000);

  // Aggregate by model
  const modelProgress: Record<
    string,
    { total: number; completed: number; failed: number }
  > = {};
  modelStats?.forEach((task) => {
    if (!modelProgress[task.model]) {
      modelProgress[task.model] = { total: 0, completed: 0, failed: 0 };
    }
    modelProgress[task.model].total++;
    if (task.status === 'completed') modelProgress[task.model].completed++;
    if (task.status === 'failed') modelProgress[task.model].failed++;
  });

  // Get recent batches
  const { data: batches } = await supabase
    .from('colorpicker_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  // Get recent failures
  const { data: failures } = await supabase
    .from('colorpicker_tasks')
    .select('*')
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(20);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">ColorPicker Batch Processing</h1>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <StatCard title="Total Tasks" value={(totalCount || 0).toLocaleString()} />
        <StatCard
          title="Completed"
          value={(completedCount || 0).toLocaleString()}
          color="green"
        />
        <StatCard
          title="Failed"
          value={(failedCount || 0).toLocaleString()}
          color="red"
        />
        <StatCard
          title="Pending"
          value={(pendingCount || 0).toLocaleString()}
          color="yellow"
        />
        <StatCard
          title="Processing"
          value={(processingCount || 0).toLocaleString()}
          color="blue"
        />
        <StatCard title="Progress" value={`${percentComplete}%`} />
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Overall Progress</span>
          <span>
            {completedCount?.toLocaleString()} / {totalCount?.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
          <div
            className="bg-green-500 h-6 rounded-full transition-all duration-500 flex items-center justify-center text-white text-sm font-medium"
            style={{ width: `${Math.max(percentComplete, 2)}%` }}
          >
            {percentComplete > 10 && `${percentComplete}%`}
          </div>
        </div>
      </div>

      {/* Recent Batches */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Recent Batches</h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                  Completed
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                  Failed
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                  Rate
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {batches?.map((batch) => (
                <tr key={batch.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">
                    {batch.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={batch.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {batch.completed_tasks?.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-red-600">
                    {batch.failed_tasks}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {batch.images_per_second?.toFixed(1)} img/s
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatDuration(batch.total_duration_seconds)}
                  </td>
                </tr>
              ))}
              {(!batches || batches.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No batches yet. Run `modal run colorpicker_batch.py --action
                    run` to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model Progress */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Model Progress</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(modelProgress)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(0, 30)
            .map(([model, stats]) => {
              const pct = stats.total
                ? Math.round((stats.completed / stats.total) * 100)
                : 0;
              return (
                <div key={model} className="bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between mb-2">
                    <span className="font-mono text-sm font-medium">{model}</span>
                    <span className="text-sm text-gray-600">{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded h-2 mb-2">
                    <div
                      className="bg-blue-500 h-2 rounded transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    {stats.completed}/{stats.total}
                    {stats.failed > 0 && (
                      <span className="text-red-500 ml-2">
                        ({stats.failed} failed)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
        {Object.keys(modelProgress).length > 30 && (
          <p className="text-center text-gray-500 mt-4">
            Showing 30 of {Object.keys(modelProgress).length} models
          </p>
        )}
      </div>

      {/* Recent Failures */}
      {failures && failures.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-red-600">
            Recent Failures
          </h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-red-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Model
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Colors
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Error
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                    Attempts
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {failures.map((task) => (
                  <tr key={task.id} className="hover:bg-red-50">
                    <td className="px-4 py-3 font-mono text-sm">{task.model}</td>
                    <td className="px-4 py-3 text-sm">
                      {task.primary_color}/{task.accent_color}/{task.led_color}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 max-w-md truncate">
                      {task.error_message?.slice(0, 100)}
                    </td>
                    <td className="px-4 py-3 text-right">{task.attempts}/3</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CLI Commands Reference */}
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
            <span className="text-gray-400">
              # Run batch processing (test with limit)
            </span>
            <br />
            modal run modal_functions/colorpicker_batch.py --action run --max-tasks
            100
          </div>
          <div>
            <span className="text-gray-400"># Run full batch processing</span>
            <br />
            modal run modal_functions/colorpicker_batch.py --action run --batch-size
            100 --max-parallel 90
          </div>
          <div>
            <span className="text-gray-400"># Check status</span>
            <br />
            modal run modal_functions/colorpicker_batch.py --action status
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color?: 'green' | 'red' | 'yellow' | 'blue';
}) {
  const colorClasses = {
    green: 'text-green-600',
    red: 'text-red-600',
    yellow: 'text-yellow-600',
    blue: 'text-blue-600',
  };
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-sm text-gray-500 mb-1">{title}</div>
      <div
        className={`text-2xl font-bold ${color ? colorClasses[color] : 'text-gray-900'}`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}
    >
      {status}
    </span>
  );
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
