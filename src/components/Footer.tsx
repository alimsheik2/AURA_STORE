import { Link } from 'react-router-dom';
import { Store, Twitter, Facebook, Instagram, Youtube } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="bg-slate-900 text-gray-300 mt-20">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-sky-500 rounded-lg flex items-center justify-center">
                <Store className="text-white" size={20} />
              </div>
              <span className="text-xl font-bold text-white">{t('brand.name')}</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              {t('footer.aboutText')}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">{t('footer.getToKnow')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="hover:text-sky-400 transition-colors">{t('footer.about')}</Link></li>
              <li><Link to="/careers" className="hover:text-sky-400 transition-colors">{t('footer.careers')}</Link></li>
              <li><Link to="/press" className="hover:text-sky-400 transition-colors">{t('footer.press')}</Link></li>
              <li><Link to="/become-vendor" className="hover:text-sky-400 transition-colors">{t('nav.becomeVendor')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">{t('footer.customerService')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/orders" className="hover:text-sky-400 transition-colors">{t('footer.trackOrder')}</Link></li>
              <li><Link to="/returns" className="hover:text-sky-400 transition-colors">{t('footer.returns')}</Link></li>
              <li><Link to="/help" className="hover:text-sky-400 transition-colors">{t('footer.help')}</Link></li>
              <li><Link to="/contact" className="hover:text-sky-400 transition-colors">{t('footer.contact')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">{t('footer.connect')}</h4>
            <div className="flex gap-3">
              <a href="#" className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-sky-500 transition-colors">
                <Twitter size={18} />
              </a>
              <a href="#" className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-sky-500 transition-colors">
                <Facebook size={18} />
              </a>
              <a href="#" className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-sky-500 transition-colors">
                <Instagram size={18} />
              </a>
              <a href="#" className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-sky-500 transition-colors">
                <Youtube size={18} />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">{t('footer.copyright', { year: new Date().getFullYear(), brand: t('brand.name') })}</p>
          <div className="flex gap-6 text-sm text-gray-400">
            <Link to="/privacy" className="hover:text-sky-400 transition-colors">{t('footer.privacy')}</Link>
            <Link to="/terms" className="hover:text-sky-400 transition-colors">{t('footer.terms')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
