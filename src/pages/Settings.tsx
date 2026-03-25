import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Settings as SettingsIcon, 
  DollarSign,
  Phone,
  Mail,
  Save,
  CreditCard,
  Upload,
  ImageIcon,
  Trash2
} from 'lucide-react';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function Settings() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  
  const [formData, setFormData] = useState({
    store_name: 'New Square Bookstore',
    store_logo_url: '',
    favicon_url: '',
    store_cell_phone: '',
    default_profit_margin: 20,
    currency: 'USD',
    sola_ifields_key: '',
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        store_name: settings.store_name || 'New Square Bookstore',
        store_logo_url: settings.store_logo_url || '',
        favicon_url: (settings as any).favicon_url || '',
        store_cell_phone: (settings as any).store_cell_phone || '',
        default_profit_margin: settings.default_profit_margin,
        currency: settings.currency,
        sola_ifields_key: settings.sola_ifields_key || '',
      });
    }
  }, [settings]);

  const handleImageUpload = async (
    file: File, 
    type: 'logo' | 'favicon',
    setUploading: (v: boolean) => void
  ) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB for logo, 500KB for favicon)
    const maxSize = type === 'favicon' ? 500 * 1024 : 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`Image must be smaller than ${type === 'favicon' ? '500KB' : '2MB'}`);
      return;
    }

    setUploading(true);
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const filePath = `${type}s/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('store-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('store-assets')
        .getPublicUrl(filePath);

      if (type === 'logo') {
        setFormData(prev => ({ ...prev, store_logo_url: publicUrl }));
      } else {
        setFormData(prev => ({ ...prev, favicon_url: publicUrl }));
      }
      toast.success(`${type === 'logo' ? 'Logo' : 'Favicon'} uploaded! Click Save to apply.`);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Failed to upload: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file, 'logo', setUploadingLogo);
  };

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file, 'favicon', setUploadingFavicon);
  };

  const handleRemoveLogo = () => {
    setFormData({ ...formData, store_logo_url: '' });
  };

  const handleRemoveFavicon = () => {
    setFormData({ ...formData, favicon_url: '' });
  };

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      store_name: formData.store_name,
      store_logo_url: formData.store_logo_url || null,
      favicon_url: formData.favicon_url || null,
      store_cell_phone: formData.store_cell_phone || null,
      default_profit_margin: formData.default_profit_margin,
      currency: formData.currency,
      sola_ifields_key: formData.sola_ifields_key || null,
    } as any);
  };

  if (isLoading) {
    return (
      <AppLayout title="Settings">
        <div className="text-center py-12 text-muted-foreground">Loading settings...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout 
      title="Settings" 
      subtitle="Configure your bookstore settings"
      actions={
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      }
    >
      <div className="max-w-2xl space-y-6 animate-fade-in">
        {/* Store Settings */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              Store Information
            </CardTitle>
            <CardDescription>
              Your bookstore name used in customer notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Store Name</Label>
              <Input
                value={formData.store_name}
                onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                placeholder="New Square Bookstore"
              />
              <p className="text-xs text-muted-foreground">
                This name is used in phone calls and SMS notifications to customers
              </p>
            </div>

            {/* Logo Upload Section */}
            <div className="space-y-2">
              <Label>Store Logo (Sidebar)</Label>
              <div className="flex items-start gap-4">
                {formData.store_logo_url ? (
                  <div className="relative">
                    <img 
                      src={formData.store_logo_url} 
                      alt="Store logo" 
                      className="w-20 h-20 object-contain rounded-lg border bg-white"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 w-6 h-6"
                      onClick={handleRemoveLogo}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50">
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Logo displayed in the sidebar. PNG, JPG, SVG. Max 2MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Favicon Upload Section */}
            <div className="space-y-2">
              <Label>Browser Icon (Favicon)</Label>
              <div className="flex items-start gap-4">
                {formData.favicon_url ? (
                  <div className="relative">
                    <img 
                      src={formData.favicon_url} 
                      alt="Favicon" 
                      className="w-12 h-12 object-contain rounded border bg-white"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 w-5 h-5"
                      onClick={handleRemoveFavicon}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded border-2 border-dashed flex items-center justify-center bg-muted/50">
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept="image/png,image/x-icon,image/svg+xml"
                    className="hidden"
                    onChange={handleFaviconUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => faviconInputRef.current?.click()}
                    disabled={uploadingFavicon}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingFavicon ? 'Uploading...' : 'Upload Favicon'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Small icon shown in browser tab. PNG, ICO, or SVG. Max 500KB. Recommended: 32x32 or 64x64 pixels.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Settings */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Pricing Settings
            </CardTitle>
            <CardDescription>
              Configure default profit margins for book pricing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Profit Margin (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.default_profit_margin}
                  onChange={(e) => setFormData({ ...formData, default_profit_margin: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">
                  This margin is applied to book cost to calculate selling price
                </p>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  placeholder="USD"
                />
              </div>
            </div>
            <div className="p-4 bg-secondary/30 rounded-lg">
              <p className="text-sm font-medium">Example Calculation</p>
              <p className="text-sm text-muted-foreground mt-1">
                Book cost: $10.00 + {formData.default_profit_margin}% margin = <span className="font-medium text-foreground">${(10 * (1 + formData.default_profit_margin / 100)).toFixed(2)}</span> selling price
              </p>
            </div>
          </CardContent>
        </Card>

        {/* SignalWire Settings */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Phone System & SignalWire Integration
            </CardTitle>
            <CardDescription>
              Automated phone calls, SMS, and incoming call management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Store Cell Phone - For call forwarding */}
            <div className="space-y-2">
              <Label>Your Cell Phone Number</Label>
              <Input
                value={formData.store_cell_phone}
                onChange={(e) => setFormData({ ...formData, store_cell_phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
              <p className="text-xs text-muted-foreground">
                Your personal cell phone. Incoming calls will be forwarded here, and click-to-call will ring this number first.
              </p>
            </div>

            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">SignalWire Configured</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                SignalWire credentials are securely stored in Supabase Edge Function secrets. 
                The notification system is ready to use.
              </p>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">Space URL</span>
                <span className="font-mono text-xs">••••••••.signalwire.com</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">Project ID</span>
                <span className="font-mono text-xs">••••••••-••••-••••</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">API Token</span>
                <span className="font-mono text-xs">••••••••••••••••</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">From Number</span>
                <span className="font-mono text-xs">••••••••••</span>
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">Notification Features:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Phone Calls:</strong> Automated text-to-speech calls</li>
                <li>• <strong>SMS:</strong> Text message notifications</li>
                <li>• <strong>Incoming Calls:</strong> Caller ID lookup, announces customer name</li>
                <li>• <strong>Click-to-Call:</strong> Call customers from the app</li>
                <li>• Notification preference set per customer</li>
                <li>• All calls and notifications are logged for tracking</li>
              </ul>
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                📞 Incoming Call Setup
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                To receive incoming calls with caller ID, set up the webhook in SignalWire:
              </p>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                <li>Go to your SignalWire Phone Numbers</li>
                <li>Edit your number's settings</li>
                <li>Set "When a call comes in" webhook to:</li>
              </ol>
              <code className="text-xs bg-muted px-2 py-1 rounded block mt-2 break-all">
                https://your-project.supabase.co/functions/v1/handle-incoming-call
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Resend Email Settings */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Integration (Resend)
            </CardTitle>
            <CardDescription>
              Send emails to customers and suppliers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">Resend Configured</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Email service is securely configured via Supabase Edge Function secrets.
              </p>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">API Key</span>
                <span className="font-mono text-xs">re_••••••••••••••••</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">From Address</span>
                <span className="font-mono text-xs">onboarding@resend.dev</span>
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">Email Features:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Customer Emails:</strong> Order ready, order received notifications</li>
                <li>• <strong>Supplier Emails:</strong> New orders, order updates</li>
                <li>• Beautiful HTML email templates</li>
                <li>• Automatic status tracking</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Sola Payments Settings */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Sola Payments Integration
            </CardTitle>
            <CardDescription>
              Accept credit card payments at checkout
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.sola_ifields_key ? (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">iFields Key Configured</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Card tokenization is enabled. Make sure you've also set the API key secret.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                  <span className="text-sm font-medium">Not Configured</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Add your Sola iFields key below to enable card payments.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>iFields Key (Public - Safe for Frontend)</Label>
                <Input
                  value={formData.sola_ifields_key}
                  onChange={(e) => setFormData({ ...formData, sola_ifields_key: e.target.value })}
                  placeholder="ifields_..."
                />
                <p className="text-xs text-muted-foreground">
                  This public key is used in the browser for secure card tokenization. Card data never touches your server.
                </p>
              </div>
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                🔐 API Key Setup (Required for Processing)
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                The API key must be stored as a <strong>Supabase Edge Function secret</strong> for security:
              </p>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                <li>Go to <a href="https://supabase.com/dashboard/project/dbpkdibyecqnlwrmqwjr/settings/functions" target="_blank" rel="noopener noreferrer" className="text-primary underline">Supabase Dashboard → Edge Functions</a></li>
                <li>Click "Manage secrets"</li>
                <li>Add: <code className="bg-muted px-1 rounded">SOLA_API_KEY</code> = your API key</li>
              </ol>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">Security Architecture:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Card data entered in <strong>Sola's secure iframes</strong></li>
                <li>✓ Card numbers <strong>never touch your server</strong></li>
                <li>✓ Only single-use tokens are transmitted</li>
                <li>✓ API key stored in Edge Function secrets (not database)</li>
                <li>✓ Fully PCI-compliant</li>
              </ul>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">How to get your keys:</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Sign up at <a href="https://solapayments.com/devsdk/" target="_blank" rel="noopener" className="text-primary hover:underline">solapayments.com/devsdk</a></li>
                <li>Log in to the Sola Merchant Portal</li>
                <li>Go to Account Settings → Keys</li>
                <li>Create an <strong>iFields key</strong> (enter above)</li>
                <li>Create an <strong>API key</strong> (add to Supabase secrets)</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
