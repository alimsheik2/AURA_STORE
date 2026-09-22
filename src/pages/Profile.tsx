import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { countryOptions } from '@/constants/countries';
import { User, Heart, ShoppingBag, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('IQ');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setCountryCode(profile.country_code || 'IQ');
    }
  }, [profile]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim(),
        country_code: countryCode.toUpperCase(),
      })
      .eq('id', user.id);

    setSaving(false);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Profile updated successfully.');
      await refreshProfile();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md">
          <User size={48} className="mx-auto text-sky-500 mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Sign in to view Account</h1>
          <p className="text-sm text-slate-500 mb-6">Manage your profile, orders, addresses and account settings.</p>
          <Link to="/signin" className="px-6 py-2.5 bg-sky-500 text-white font-medium rounded-lg">Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header card */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-sky-500 text-white rounded-full flex items-center justify-center font-bold text-2xl shadow-inner">
              {(fullName || user.email || 'A')[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold">{fullName || 'Account User'}</h1>
              <p className="text-sm text-slate-300">{user.email}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-sky-500/20 text-sky-300 text-xs font-semibold rounded-full border border-sky-500/30">
                  {profile?.role === 'admin' ? 'Administrator' : profile?.role === 'vendor' ? 'Vendor' : 'Customer Account'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/orders" className="bg-white p-5 rounded-xl border border-slate-200 hover:border-sky-500 transition-colors flex items-center gap-4">
            <div className="p-3 bg-sky-100 text-sky-600 rounded-lg"><ShoppingBag size={22} /></div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">My Orders</h3>
              <p className="text-xs text-slate-500">Track and view history</p>
            </div>
          </Link>
          <Link to="/wishlist" className="bg-white p-5 rounded-xl border border-slate-200 hover:border-rose-500 transition-colors flex items-center gap-4">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-lg"><Heart size={22} /></div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Saved Wishlist</h3>
              <p className="text-xs text-slate-500">Saved items & favorites</p>
            </div>
          </Link>
          <Link to="/disputes" className="bg-white p-5 rounded-xl border border-slate-200 hover:border-amber-500 transition-colors flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-lg"><AlertCircle size={22} /></div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Disputes & Returns</h3>
              <p className="text-xs text-slate-500">Manage order issues</p>
            </div>
          </Link>
        </div>

        {/* Profile Settings Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-4">Account Profile Settings</h2>
          {message && (
            <div className="mb-4 p-3 bg-sky-50 border border-sky-200 text-sky-700 rounded-lg text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-11 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-11 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-sky-500"
                placeholder="+1 555-0192"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Country / Region</label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full h-11 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-sky-500 bg-white"
              >
                {countryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.value})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              Save Profile Changes
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
