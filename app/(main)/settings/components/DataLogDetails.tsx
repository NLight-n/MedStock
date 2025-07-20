'use client';

interface DataLogDetailsProps {
  log: {
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  } | null;
  onClose: () => void;
}

const formatValue = (value: unknown) => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

export default function DataLogDetails({ log, onClose }: DataLogDetailsProps) {
  if (!log) return null;

  const allKeys = new Set([
    ...Object.keys(log.oldValues || {}),
    ...Object.keys(log.newValues || {}),
  ]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Change Details</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">&times;</button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-lg font-semibold mb-2 border-b pb-2 text-gray-900 dark:text-gray-100">Old Values</h3>
            <div className="space-y-2">
              {Array.from(allKeys).map(key => (
                <div key={key}>
                  <strong className="block text-sm font-medium capitalize text-gray-700 dark:text-gray-300">{key}:</strong>
                  <pre className="text-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-2 rounded mt-1 whitespace-pre-wrap">{formatValue(log.oldValues?.[key])}</pre>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2 border-b pb-2 text-gray-900 dark:text-gray-100">New Values</h3>
            <div className="space-y-2">
              {Array.from(allKeys).map(key => (
                <div key={key}>
                  <strong className="block text-sm font-medium capitalize text-gray-700 dark:text-gray-300">{key}:</strong>
                  <pre className="text-sm bg-green-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-2 rounded mt-1 whitespace-pre-wrap">{formatValue(log.newValues?.[key])}</pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 