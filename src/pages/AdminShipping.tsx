import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPriceSimple } from '@/lib/utils';
import { Plus, Truck } from 'lucide-react';

interface ShippingMethod {
  id: string;
  name: string;
  code: string;
  price: number;
  estimated_days: string;
  active: boolean;
}

export default function AdminShipping() {
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [price, setPrice] = useState('5.00');
  const [estimatedDays, setEstimatedDays] = useState('3-5 business days');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchMethods = async () => {
    const { data, error } = await supabase
      .from('shipping_methods')
      .select('*')
      .order('price', { ascending: true });

    if (!error && data) {
      setMethods(data as ShippingMethod[]);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      setMessage('Price must be a valid positive number.');
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('shipping_methods').insert({
      name: name.trim(),
      code: code.trim().toLowerCase().replace(/\s+/g, '_'),
      price: numericPrice,
      estimated_days: estimatedDays.trim(),
      active: true,
    });

    setSaving(false);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Shipping method created successfully.');
      setName('');
      setCode('');
      setPrice('5.00');
      setEstimatedDays('3-5 business days');
      fetchMethods();
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('shipping_methods')
      .update({ active: !currentActive })
      .eq('id', id);

    if (!error) {
      fetchMethods();
    }
  };

  return (
    <div className="bg-white min-h-screen p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shipping Methods Management</h1>
          <p className="text-sm text-slate-500">Manage available shipping options (Standard $5, Express $15) and delivery rates.</p>
        </div>

        {message && (
          <div className="p-4 bg-sky-50 border border-sky-200 text-sky-700 rounded-lg text-sm">
            {message}
          </div>
        )}

        {/* Add Shipping Method Form */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">Add Shipping Method</h2>
          <form onSubmit={handleAddMethod} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Method Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!code) setCode(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                }}
                className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-sky-500"
                placeholder="Standard Shipping"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-sky-500"
                placeholder="standard"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-sky-500"
                placeholder="5.00"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-5 bg-sky-500 hover:bg-sky-600 text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Plus size={16} /> Save Method
            </button>
          </form>
        </div>

        {/* Methods Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Shipping Method</th>
                <th className="px-6 py-3">Code</th>
                <th className="px-6 py-3">Cost</th>
                <th className="px-6 py-3">Estimated Delivery</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {methods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-center text-slate-400">
                    No shipping methods configured.
                  </td>
                </tr>
              ) : (
                methods.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-2">
                      <Truck size={16} className="text-sky-500" />
                      {m.name}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{m.code}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{formatPriceSimple(m.price)}</td>
                    <td className="px-6 py-4 text-slate-600">{m.estimated_days}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                          m.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {m.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleActive(m.id, m.active)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${
                          m.active
                            ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {m.active ? 'Deactivate' : 'Activate'}
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
