import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Percent } from 'lucide-react';

interface CommissionRate {
  id: string;
  rate: number;
  description: string;
  active: boolean;
  created_at: string;
}

export default function AdminCommission() {
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [newRate, setNewRate] = useState<string>('10.0');
  const [description, setDescription] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchRates = async () => {
    const { data, error } = await supabase
      .from('commission_rates')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRates(data as CommissionRate[]);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const numericRate = parseFloat(newRate);
    if (isNaN(numericRate) || numericRate < 0 || numericRate > 100) {
      setMessage('Rate must be a valid percentage between 0 and 100.');
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('commission_rates').insert({
      rate: numericRate,
      description: description.trim() || `Commission Rate ${numericRate}%`,
      active: true,
    });

    setSaving(false);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Commission rate added successfully.');
      setNewRate('10.0');
      setDescription('');
      fetchRates();
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('commission_rates')
      .update({ active: !currentActive })
      .eq('id', id);

    if (!error) {
      fetchRates();
    }
  };

  return (
    <div className="bg-white min-h-screen p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Commission Rates</h1>
          <p className="text-sm text-slate-500">Configure marketplace commission rates applied at checkout.</p>
        </div>

        {message && (
          <div className="p-4 bg-sky-50 border border-sky-200 text-sky-700 rounded-lg text-sm">
            {message}
          </div>
        )}

        {/* Add New Rate Form */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">Add Commission Rate</h2>
          <form onSubmit={handleAddRate} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Commission Rate (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="w-full h-10 px-3 pr-8 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-sky-500"
                  placeholder="10.0"
                />
                <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            <div className="flex-2 w-full md:w-1/2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-sky-500"
                placeholder="Standard Vendor Commission"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-5 bg-sky-500 hover:bg-sky-600 text-white font-medium text-sm rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Plus size={16} /> Add Rate
            </button>
          </form>
        </div>

        {/* List of Rates */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Commission Rate</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-6 text-center text-slate-400">
                    No commission rates configured.
                  </td>
                </tr>
              ) : (
                rates.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-900">{r.rate}%</td>
                    <td className="px-6 py-4 text-slate-600">{r.description}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                          r.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {r.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleActive(r.id, r.active)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${
                          r.active
                            ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {r.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
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
