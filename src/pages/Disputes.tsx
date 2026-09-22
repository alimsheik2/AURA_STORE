import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/utils';
import { AlertCircle, Send } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Dispute {
  id: string;
  order_id: string;
  reason: string;
  evidence_url: string;
  status: string;
  resolution_notes: string;
  created_at: string;
}

export default function Disputes() {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchDisputes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('disputes')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDisputes(data as Dispute[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const handleCreateDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setMessage(null);

    const { error } = await supabase.from('disputes').insert({
      user_id: user.id,
      order_id: orderId.trim(),
      reason: reason.trim(),
      status: 'open',
    });

    setSubmitting(false);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Dispute ticket opened successfully.');
      setOrderId('');
      setReason('');
      setShowModal(false);
      fetchDisputes();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md">
          <AlertCircle size={48} className="mx-auto text-amber-500 mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Sign in to view Disputes</h1>
          <p className="text-sm text-slate-500 mb-6">Manage order dispute cases and customer resolutions.</p>
          <Link to="/signin" className="px-6 py-2.5 bg-sky-500 text-white font-medium rounded-lg">Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
              <AlertCircle size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Order Disputes & Returns</h1>
              <p className="text-sm text-slate-500">Track and resolve marketplace order dispute requests.</p>
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
          >
            Open New Dispute
          </button>
        </div>

        {message && (
          <div className="p-4 bg-sky-50 border border-sky-200 text-sky-700 rounded-lg text-sm">
            {message}
          </div>
        )}

        {/* Modal for opening new dispute */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">File an Order Dispute</h2>
              <form onSubmit={handleCreateDispute} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Order ID</label>
                  <input
                    type="text"
                    required
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-sky-500 font-mono"
                    placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Dispute</label>
                  <textarea
                    required
                    rows={4}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-sky-500"
                    placeholder="Describe the issue (damaged item, incorrect item, non-delivery)..."
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    <Send size={16} /> Submit Ticket
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Disputes List */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Dispute ID</th>
                <th className="px-6 py-3">Order ID</th>
                <th className="px-6 py-3">Reason</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">Loading dispute tickets...</td>
                </tr>
              ) : disputes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">No active or resolved order disputes.</td>
                </tr>
              ) : (
                disputes.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono text-xs text-slate-900">{d.id.slice(0, 8)}...</td>
                    <td className="px-6 py-4 font-mono text-xs text-sky-600">{d.order_id.slice(0, 8)}...</td>
                    <td className="px-6 py-4 text-slate-700 max-w-xs truncate">{d.reason}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                        d.status === 'open' ? 'bg-amber-100 text-amber-700' :
                        d.status === 'resolved_refund' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{formatDate(d.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
