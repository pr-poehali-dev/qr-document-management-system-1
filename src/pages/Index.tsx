import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import Icon from '@/components/ui/icon';
import QRCode from 'qrcode';

type UserRole = 'client' | 'cashier' | 'admin' | 'creator' | 'nikitovsky' | 'head-cashier' | 'super-admin' | null;

interface Document {
  id: string;
  qrCode: string;
  firstName: string;
  lastName: string;
  middleName: string;
  phone: string;
  email: string;
  itemDescription: string;
  category: 'documents' | 'photos' | 'cards' | 'other';
  depositAmount: number;
  pickupAmount: number;
  depositDate: string;
  pickupDate: string;
  status: 'active' | 'archived';
  createdBy: string;
  createdAt: string;
}

interface User {
  id: string;
  username: string;
  role: UserRole;
  isBlocked: boolean;
  createdAt: string;
}

const PASSWORDS: Record<string, string> = {
  cashier: '25',
  admin: '2025',
  creator: '202505',
  nikitovsky: '20252025',
  'head-cashier': '202520',
  'super-admin': '2505',
  archive: '202505',
};

const CATEGORY_LIMITS: Record<string, number> = {
  documents: 100,
  photos: 100,
  cards: 100,
  other: 999,
};

export default function Index() {
  const [currentRole, setCurrentRole] = useState<UserRole>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginStep, setLoginStep] = useState<'role' | 'auth' | 'nikitovskyAuth'>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  
  const [users, setUsers] = useState<User[]>([
    { id: '1', username: 'Никитовский', role: 'nikitovsky', isBlocked: false, createdAt: new Date().toISOString() },
    { id: '2', username: '24', role: 'super-admin', isBlocked: false, createdAt: new Date().toISOString() },
  ]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [archivedDocuments, setArchivedDocuments] = useState<Document[]>([]);
  const [showNewDocForm, setShowNewDocForm] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showRoleManagement, setShowRoleManagement] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [archivePassword, setArchivePassword] = useState('');
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [qrImage, setQrImage] = useState('');
  const [scannedQR, setScannedQR] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Document | null>(null);
  
  const [newUserForm, setNewUserForm] = useState({ username: '', role: 'client' as UserRole, password: '' });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    phone: '',
    email: '',
    itemDescription: '',
    category: 'documents' as Document['category'],
    depositAmount: '',
    pickupAmount: '',
    pickupDate: '',
  });

  useEffect(() => {
    if (lockoutTime) {
      const timer = setInterval(() => {
        const remaining = lockoutTime - Date.now();
        if (remaining <= 0) {
          setLockoutTime(null);
          setFailedAttempts(0);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTime]);

  const handleRoleSelect = (role: string) => {
    if (role === 'nikitovsky-group') {
      setLoginStep('nikitovskyAuth');
      return;
    }
    setSelectedRole(role as UserRole);
    setLoginStep('auth');
  };

  const handleNikitovskyLogin = () => {
    if (lockoutTime && Date.now() < lockoutTime) {
      const remaining = Math.ceil((lockoutTime - Date.now()) / 1000);
      toast.error(`Вход заблокирован. Осталось ${remaining} секунд`);
      return;
    }

    if (password === PASSWORDS.nikitovsky) {
      const user = users.find(u => u.username === 'Никитовский');
      if (user && !user.isBlocked) {
        setCurrentRole('nikitovsky');
        setCurrentUser(user);
        setFailedAttempts(0);
        setLoginStep('role');
        toast.success('Вход выполнен как Никитовский');
        return;
      }
    }
    
    if (password === PASSWORDS['super-admin']) {
      const user = users.find(u => u.username === '24');
      if (user && !user.isBlocked) {
        setCurrentRole('super-admin');
        setCurrentUser(user);
        setFailedAttempts(0);
        setLoginStep('role');
        toast.success('Вход выполнен как Супер-админ (24)');
        return;
      }
    }

    const newAttempts = failedAttempts + 1;
    setFailedAttempts(newAttempts);
    
    if (newAttempts >= 3) {
      setLockoutTime(Date.now() + 90000);
      toast.error('3 неудачные попытки. Блокировка на 90 секунд');
    } else {
      toast.error(`Неверный пароль. Попытка ${newAttempts}/3`);
    }
  };

  const handleLogin = () => {
    if (lockoutTime && Date.now() < lockoutTime) {
      const remaining = Math.ceil((lockoutTime - Date.now()) / 1000);
      toast.error(`Вход заблокирован. Осталось ${remaining} секунд`);
      return;
    }

    const user = users.find(u => u.username === username && u.role === selectedRole);
    
    if (!user) {
      toast.error('Пользователь не найден в базе');
      return;
    }

    if (user.isBlocked) {
      toast.error('Пользователь заблокирован');
      return;
    }

    if (selectedRole && PASSWORDS[selectedRole] === password) {
      setCurrentRole(selectedRole);
      setCurrentUser(user);
      setFailedAttempts(0);
      setLoginStep('role');
      toast.success(`Вход выполнен: ${getRoleName(selectedRole)}`);
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      
      if (newAttempts >= 3) {
        setLockoutTime(Date.now() + 90000);
        toast.error('3 неудачные попытки. Блокировка на 90 секунд');
      } else {
        toast.error(`Неверный пароль. Попытка ${newAttempts}/3`);
      }
    }
  };

  const handleLogout = () => {
    setCurrentRole(null);
    setCurrentUser(null);
    setUsername('');
    setPassword('');
    setShowArchive(false);
    setShowRoleManagement(false);
    toast.info('Выход выполнен');
  };

  const generateQR = async (text: string): Promise<string> => {
    try {
      return await QRCode.toDataURL(text);
    } catch (err) {
      console.error(err);
      return '';
    }
  };

  const generateRandomQRCode = (): string => {
    return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
  };

  const handleCreateDocument = async () => {
    if (!formData.firstName || !formData.lastName || !formData.phone) {
      toast.error('Заполните обязательные поля: Имя, Фамилия, Телефон');
      return;
    }

    const categoryCount = documents.filter(d => d.category === formData.category).length;
    if (categoryCount >= CATEGORY_LIMITS[formData.category]) {
      toast.error(`Достигнут лимит для категории "${formData.category}": ${CATEGORY_LIMITS[formData.category]} предметов`);
      return;
    }

    const docNumber = generateRandomQRCode();
    const qrImageData = await generateQR(docNumber);

    const newDoc: Document = {
      id: Date.now().toString(),
      qrCode: docNumber,
      firstName: formData.firstName,
      lastName: formData.lastName,
      middleName: formData.middleName,
      phone: formData.phone,
      email: formData.email,
      itemDescription: formData.itemDescription,
      category: formData.category,
      depositAmount: Number(formData.depositAmount) || 0,
      pickupAmount: Number(formData.pickupAmount) || 0,
      depositDate: new Date().toISOString(),
      pickupDate: formData.pickupDate,
      status: 'active',
      createdBy: currentUser?.username || currentRole || 'system',
      createdAt: new Date().toISOString(),
    };

    setDocuments(prev => [...prev, newDoc]);
    setShowNewDocForm(false);
    setFormData({
      firstName: '',
      lastName: '',
      middleName: '',
      phone: '',
      email: '',
      itemDescription: '',
      category: 'documents',
      depositAmount: '',
      pickupAmount: '',
      pickupDate: '',
    });

    toast.success(`Документ создан с номером ${docNumber}`);
    setQrImage(qrImageData);
    setShowQRDialog(true);
    
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(`Номер документа ${docNumber.split('').join(' ')}`);
      utterance.lang = 'ru-RU';
      speechSynthesis.speak(utterance);
    }
  };

  const handleIssueDocument = (doc: Document) => {
    const updatedDoc = { ...doc, status: 'archived' as const };
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
    setArchivedDocuments(prev => [...prev, updatedDoc]);
    toast.success(`Документ ${doc.qrCode} выдан и перемещён в архив`);
    
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(`Выдан документ номер ${doc.qrCode.split('').join(' ')}`);
      utterance.lang = 'ru-RU';
      speechSynthesis.speak(utterance);
    }
  };

  const handleDeleteDocument = (doc: Document) => {
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
    setDeleteConfirm(null);
    toast.success(`Документ ${doc.qrCode} удалён`);
  };

  const handleShowQR = async (qrCode: string) => {
    const qrImageData = await generateQR(qrCode);
    setQrImage(qrImageData);
    setShowQRDialog(true);
  };

  const handleScanQR = () => {
    setShowScanner(true);
    setTimeout(async () => {
      if (videoRef.current && navigator.mediaDevices) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        } catch (err) {
          toast.error('Не удалось получить доступ к камере');
        }
      }
    }, 100);
  };

  const processScannedQR = (qrCode: string) => {
    const doc = documents.find(d => d.qrCode === qrCode);
    if (doc) {
      handleIssueDocument(doc);
      setShowScanner(false);
      setScannedQR('');
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    } else {
      toast.error('Документ с таким QR-кодом не найден');
    }
  };

  const handleCreateUser = () => {
    if (!newUserForm.username || !newUserForm.password) {
      toast.error('Заполните имя пользователя и пароль');
      return;
    }

    if (users.find(u => u.username === newUserForm.username)) {
      toast.error('Пользователь с таким именем уже существует');
      return;
    }

    const newUser: User = {
      id: Date.now().toString(),
      username: newUserForm.username,
      role: newUserForm.role,
      isBlocked: false,
      createdAt: new Date().toISOString(),
    };

    setUsers(prev => [...prev, newUser]);
    setNewUserForm({ username: '', role: 'client', password: '' });
    toast.success(`Пользователь ${newUser.username} создан`);
  };

  const handleToggleUserBlock = (userId: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const newBlockStatus = !u.isBlocked;
        toast.info(`Пользователь ${u.username} ${newBlockStatus ? 'заблокирован' : 'разблокирован'}`);
        return { ...u, isBlocked: newBlockStatus };
      }
      return u;
    }));
  };

  const handleChangeUserRole = (userId: string, newRole: UserRole) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        toast.success(`Роль пользователя ${u.username} изменена на ${getRoleName(newRole)}`);
        return { ...u, role: newRole };
      }
      return u;
    }));
  };

  const handlePrintForm = (doc?: Document) => {
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    const content = `
      <html>
        <head>
          <title>Анкета клиента</title>
          <style>
            body { font-family: Arial; padding: 40px; }
            .field { margin: 20px 0; border-bottom: 1px solid #000; padding-bottom: 5px; }
            .label { font-weight: bold; margin-bottom: 5px; }
          </style>
        </head>
        <body>
          <h1>АНКЕТА КЛИЕНТА</h1>
          <div class="field"><div class="label">Фамилия:</div>${doc?.lastName || '_______________________'}</div>
          <div class="field"><div class="label">Имя:</div>${doc?.firstName || '_______________________'}</div>
          <div class="field"><div class="label">Отчество:</div>${doc?.middleName || '_______________________'}</div>
          <div class="field"><div class="label">Телефон:</div>${doc?.phone || '_______________________'}</div>
          <div class="field"><div class="label">Email:</div>${doc?.email || '_______________________'}</div>
          <div class="field"><div class="label">Описание предмета:</div>${doc?.itemDescription || '_______________________'}</div>
          <div class="field"><div class="label">Сумма при сдаче:</div>${doc?.depositAmount || '_______________________'}</div>
          <div class="field"><div class="label">Сумма при получении:</div>${doc?.pickupAmount || '_______________________'}</div>
          <div class="field"><div class="label">Дата получения:</div>${doc?.pickupDate || '_______________________'}</div>
        </body>
      </html>
    `;
    
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const getRoleName = (role: UserRole): string => {
    const names: Record<string, string> = {
      client: 'Покупатель',
      cashier: 'Кассир',
      admin: 'Администратор',
      creator: 'Создатель',
      nikitovsky: 'Никитовский',
      'head-cashier': 'Главный кассир',
      'super-admin': 'Супер-админ (24)',
    };
    return names[role || ''] || '';
  };

  const canCreateDocuments = currentRole && ['cashier', 'admin', 'creator', 'nikitovsky', 'head-cashier', 'super-admin'].includes(currentRole);
  const canViewArchive = currentRole && ['admin', 'creator', 'nikitovsky', 'super-admin'].includes(currentRole);
  const canManageRoles = currentRole && ['nikitovsky', 'super-admin'].includes(currentRole);
  const canDeleteDocuments = currentRole === 'super-admin';
  const canManageNikitovsky = currentRole === 'super-admin';

  if (!currentRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-zinc-700 bg-zinc-800/50 backdrop-blur">
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 bg-black rounded-xl flex items-center justify-center mb-4 shadow-xl">
              <Icon name="FileText" size={40} className="text-white" />
            </div>
            <CardTitle className="text-3xl font-bold text-white">QR Документы</CardTitle>
            <CardDescription className="text-zinc-400">Система управления документами v3.0</CardDescription>
          </CardHeader>
          <CardContent>
            {loginStep === 'role' ? (
              <div className="space-y-3">
                <Button onClick={() => handleRoleSelect('client')} className="w-full h-14 text-lg bg-zinc-700 hover:bg-zinc-600 text-white border-zinc-600">
                  <Icon name="User" className="mr-2" />
                  Покупатель
                </Button>
                <Button onClick={() => handleRoleSelect('cashier')} className="w-full h-14 text-lg bg-zinc-700 hover:bg-zinc-600 text-white border-zinc-600">
                  <Icon name="Calculator" className="mr-2" />
                  Кассир
                </Button>
                <Button onClick={() => handleRoleSelect('head-cashier')} className="w-full h-14 text-lg bg-zinc-700 hover:bg-zinc-600 text-white border-zinc-600">
                  <Icon name="Crown" className="mr-2" />
                  Главный кассир
                </Button>
                <Button onClick={() => handleRoleSelect('admin')} className="w-full h-14 text-lg bg-zinc-700 hover:bg-zinc-600 text-white border-zinc-600">
                  <Icon name="Shield" className="mr-2" />
                  Администратор
                </Button>
                <Button onClick={() => handleRoleSelect('creator')} className="w-full h-14 text-lg bg-zinc-700 hover:bg-zinc-600 text-white border-zinc-600">
                  <Icon name="Settings" className="mr-2" />
                  Создатель
                </Button>
                <Button onClick={() => handleRoleSelect('nikitovsky-group')} className="w-full h-14 text-lg bg-black hover:bg-zinc-900 text-white border-zinc-700">
                  <Icon name="Sparkles" className="mr-2" />
                  Никитовский / 24
                </Button>
              </div>
            ) : loginStep === 'nikitovskyAuth' ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-zinc-300">Введите пароль</Label>
                  <Input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Пароль Никитовского или 24" 
                    className="bg-zinc-700 border-zinc-600 text-white"
                    onKeyDown={(e) => e.key === 'Enter' && handleNikitovskyLogin()}
                  />
                  <p className="text-xs text-zinc-500 mt-2">20252025 - Никитовский | 2505 - Супер-админ (24)</p>
                </div>
                {lockoutTime && Date.now() < lockoutTime && (
                  <p className="text-sm text-red-400">Блокировка: {Math.ceil((lockoutTime - Date.now()) / 1000)} сек</p>
                )}
                <div className="flex gap-2">
                  <Button onClick={() => { setLoginStep('role'); setPassword(''); }} variant="outline" className="flex-1 bg-zinc-700 border-zinc-600 text-white hover:bg-zinc-600">
                    Назад
                  </Button>
                  <Button onClick={handleNikitovskyLogin} className="flex-1 bg-black hover:bg-zinc-900" disabled={lockoutTime !== null && Date.now() < lockoutTime}>
                    Войти
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-zinc-300">Имя пользователя</Label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Введите имя" className="bg-zinc-700 border-zinc-600 text-white" />
                </div>
                <div>
                  <Label className="text-zinc-300">Пароль</Label>
                  <Input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Введите пароль" 
                    className="bg-zinc-700 border-zinc-600 text-white"
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                </div>
                {lockoutTime && Date.now() < lockoutTime && (
                  <p className="text-sm text-red-400">Блокировка: {Math.ceil((lockoutTime - Date.now()) / 1000)} сек</p>
                )}
                <div className="flex gap-2">
                  <Button onClick={() => { setLoginStep('role'); setPassword(''); setUsername(''); }} variant="outline" className="flex-1 bg-zinc-700 border-zinc-600 text-white hover:bg-zinc-600">
                    Назад
                  </Button>
                  <Button onClick={handleLogin} className="flex-1 bg-black hover:bg-zinc-900" disabled={lockoutTime !== null && Date.now() < lockoutTime}>
                    Войти
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showRoleManagement) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-white">Управление ролями</h1>
              <p className="text-zinc-400 mt-2">Создание и управление пользователями</p>
            </div>
            <Button onClick={() => setShowRoleManagement(false)} variant="outline" className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
              <Icon name="ArrowLeft" className="mr-2" />
              Назад
            </Button>
          </div>

          <div className="grid gap-6 mb-8">
            <Card className="border-zinc-700 bg-zinc-800/50">
              <CardHeader>
                <CardTitle className="text-white">Создать нового пользователя</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-zinc-300">Имя пользователя</Label>
                    <Input 
                      value={newUserForm.username} 
                      onChange={(e) => setNewUserForm({...newUserForm, username: e.target.value})} 
                      placeholder="Введите имя"
                      className="bg-zinc-700 border-zinc-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-zinc-300">Роль</Label>
                    <Select value={newUserForm.role} onValueChange={(value) => setNewUserForm({...newUserForm, role: value as UserRole})}>
                      <SelectTrigger className="bg-zinc-700 border-zinc-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        <SelectItem value="client">Покупатель</SelectItem>
                        <SelectItem value="cashier">Кассир</SelectItem>
                        <SelectItem value="head-cashier">Главный кассир</SelectItem>
                        <SelectItem value="admin">Администратор</SelectItem>
                        {currentRole === 'super-admin' && <SelectItem value="creator">Создатель</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleCreateUser} className="w-full bg-black hover:bg-zinc-900">
                      <Icon name="Plus" className="mr-2" />
                      Создать
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-700 bg-zinc-800/50">
              <CardHeader>
                <CardTitle className="text-white">Список пользователей ({users.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-700 hover:bg-zinc-700/50">
                      <TableHead className="text-zinc-300">Имя</TableHead>
                      <TableHead className="text-zinc-300">Роль</TableHead>
                      <TableHead className="text-zinc-300">Статус</TableHead>
                      <TableHead className="text-zinc-300">Дата создания</TableHead>
                      <TableHead className="text-zinc-300">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(user => (
                      <TableRow key={user.id} className="border-zinc-700 hover:bg-zinc-700/30">
                        <TableCell className="text-white font-semibold">{user.username}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-zinc-600 text-zinc-300">
                            {getRoleName(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isBlocked ? 'destructive' : 'default'} className={user.isBlocked ? '' : 'bg-green-900 text-green-300'}>
                            {user.isBlocked ? 'Заблокирован' : 'Активен'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-zinc-400">{new Date(user.createdAt).toLocaleDateString('ru-RU')}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {(canManageNikitovsky || (user.role !== 'nikitovsky' && user.role !== 'super-admin')) && (
                              <Button 
                                size="sm" 
                                variant={user.isBlocked ? 'default' : 'destructive'} 
                                onClick={() => handleToggleUserBlock(user.id)}
                                className={user.isBlocked ? 'bg-green-900 hover:bg-green-800' : ''}
                              >
                                <Icon name={user.isBlocked ? 'Unlock' : 'Lock'} size={16} />
                              </Button>
                            )}
                            {currentRole === 'super-admin' && user.role !== 'super-admin' && (
                              <Select value={user.role || ''} onValueChange={(value) => handleChangeUserRole(user.id, value as UserRole)}>
                                <SelectTrigger className="h-9 w-[140px] bg-zinc-700 border-zinc-600 text-white text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-800 border-zinc-700">
                                  <SelectItem value="client">Покупатель</SelectItem>
                                  <SelectItem value="cashier">Кассир</SelectItem>
                                  <SelectItem value="head-cashier">Гл. кассир</SelectItem>
                                  <SelectItem value="admin">Администратор</SelectItem>
                                  <SelectItem value="creator">Создатель</SelectItem>
                                  <SelectItem value="nikitovsky">Никитовский</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (showArchive) {
    if (archivePassword !== PASSWORDS.archive) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-zinc-700 bg-zinc-800/50">
            <CardHeader>
              <CardTitle className="text-white">Доступ к архиву</CardTitle>
              <CardDescription className="text-zinc-400">Введите пароль архива</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input 
                type="password" 
                value={archivePassword} 
                onChange={(e) => setArchivePassword(e.target.value)} 
                placeholder="Пароль" 
                className="bg-zinc-700 border-zinc-600 text-white"
                onKeyDown={(e) => e.key === 'Enter' && archivePassword === PASSWORDS.archive && toast.success('Доступ к архиву открыт')}
              />
              <div className="flex gap-2">
                <Button onClick={() => setShowArchive(false)} variant="outline" className="flex-1 bg-zinc-700 border-zinc-600 text-white hover:bg-zinc-600">Назад</Button>
                <Button onClick={() => {
                  if (archivePassword === PASSWORDS.archive) {
                    toast.success('Доступ к архиву открыт');
                  } else {
                    toast.error('Неверный пароль');
                  }
                }} className="flex-1 bg-black hover:bg-zinc-900">Открыть</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-white">Архив документов</h1>
              <p className="text-zinc-400 mt-2">Все операции сохранены навсегда • Записей: {archivedDocuments.length}</p>
            </div>
            <Button onClick={() => { setShowArchive(false); setArchivePassword(''); }} variant="outline" className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
              <Icon name="ArrowLeft" className="mr-2" />
              Назад
            </Button>
          </div>

          <Card className="border-zinc-700 bg-zinc-800/50">
            <CardContent className="p-6">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-700 hover:bg-zinc-700/50">
                    <TableHead className="text-zinc-300">QR Код</TableHead>
                    <TableHead className="text-zinc-300">ФИО</TableHead>
                    <TableHead className="text-zinc-300">Телефон</TableHead>
                    <TableHead className="text-zinc-300">Категория</TableHead>
                    <TableHead className="text-zinc-300">Предмет</TableHead>
                    <TableHead className="text-zinc-300">Дата сдачи</TableHead>
                    <TableHead className="text-zinc-300">Дата выдачи</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedDocuments.map(doc => (
                    <TableRow key={doc.id} className="border-zinc-700 hover:bg-zinc-700/30">
                      <TableCell className="font-mono text-white">{doc.qrCode}</TableCell>
                      <TableCell className="text-zinc-300">{`${doc.lastName} ${doc.firstName} ${doc.middleName}`}</TableCell>
                      <TableCell className="text-zinc-400">{doc.phone}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-zinc-600 text-zinc-300">{doc.category}</Badge>
                      </TableCell>
                      <TableCell className="text-zinc-400">{doc.itemDescription}</TableCell>
                      <TableCell className="text-zinc-400">{new Date(doc.depositDate).toLocaleDateString('ru-RU')}</TableCell>
                      <TableCell className="text-zinc-400">{new Date().toLocaleDateString('ru-RU')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <header className="bg-black/50 border-b border-zinc-700 shadow-xl backdrop-blur">
        <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <Icon name="FileText" size={24} className="text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">QR Документы v3.0</h1>
              <p className="text-sm text-zinc-400">{getRoleName(currentRole)} • {currentUser?.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canManageRoles && (
              <Button onClick={() => setShowRoleManagement(true)} variant="outline" className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                <Icon name="Users" className="mr-2" />
                Роли
              </Button>
            )}
            {canViewArchive && (
              <Button onClick={() => setShowArchive(true)} variant="outline" className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                <Icon name="Archive" className="mr-2" />
                Архив
              </Button>
            )}
            <Button onClick={handleLogout} variant="outline" className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
              <Icon name="LogOut" className="mr-2" />
              Выход
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-white">Управление документами</h2>
            <p className="text-zinc-400 mt-2">Активных документов: {documents.length} • Архив: {archivedDocuments.length}</p>
          </div>
          <div className="flex gap-3">
            {canCreateDocuments && (
              <>
                <Button onClick={handleScanQR} size="lg" className="bg-zinc-800 hover:bg-zinc-700 text-white shadow-lg">
                  <Icon name="ScanLine" className="mr-2" />
                  Сканер
                </Button>
                <Button onClick={() => setShowNewDocForm(true)} size="lg" className="bg-black hover:bg-zinc-900 text-white shadow-lg">
                  <Icon name="Plus" className="mr-2" />
                  Новый документ
                </Button>
              </>
            )}
          </div>
        </div>

        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-zinc-800 border-zinc-700">
            <TabsTrigger value="all" className="data-[state=active]:bg-black data-[state=active]:text-white">Все ({documents.length})</TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:bg-black data-[state=active]:text-white">Документы ({documents.filter(d => d.category === 'documents').length}/{CATEGORY_LIMITS.documents})</TabsTrigger>
            <TabsTrigger value="photos" className="data-[state=active]:bg-black data-[state=active]:text-white">Фото ({documents.filter(d => d.category === 'photos').length}/{CATEGORY_LIMITS.photos})</TabsTrigger>
            <TabsTrigger value="cards" className="data-[state=active]:bg-black data-[state=active]:text-white">Карты ({documents.filter(d => d.category === 'cards').length}/{CATEGORY_LIMITS.cards})</TabsTrigger>
            <TabsTrigger value="other" className="data-[state=active]:bg-black data-[state=active]:text-white">Другое ({documents.filter(d => d.category === 'other').length})</TabsTrigger>
          </TabsList>

          {['all', 'documents', 'photos', 'cards', 'other'].map(tab => (
            <TabsContent key={tab} value={tab}>
              <Card className="border-zinc-700 bg-zinc-800/50">
                <CardContent className="p-6">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-700 hover:bg-zinc-700/50">
                        <TableHead className="text-zinc-300">QR Код</TableHead>
                        <TableHead className="text-zinc-300">ФИО</TableHead>
                        <TableHead className="text-zinc-300">Телефон</TableHead>
                        <TableHead className="text-zinc-300">Предмет</TableHead>
                        <TableHead className="text-zinc-300">Дата сдачи</TableHead>
                        <TableHead className="text-zinc-300">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents
                        .filter(doc => tab === 'all' || doc.category === tab)
                        .map(doc => (
                          <TableRow key={doc.id} className="border-zinc-700 hover:bg-zinc-700/30">
                            <TableCell className="font-mono font-semibold text-white">{doc.qrCode}</TableCell>
                            <TableCell className="text-zinc-300">{`${doc.lastName} ${doc.firstName}`}</TableCell>
                            <TableCell className="text-zinc-400">{doc.phone}</TableCell>
                            <TableCell className="max-w-xs truncate text-zinc-400">{doc.itemDescription}</TableCell>
                            <TableCell className="text-zinc-400">{new Date(doc.depositDate).toLocaleDateString('ru-RU')}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleShowQR(doc.qrCode)} className="bg-zinc-700 border-zinc-600 text-white hover:bg-zinc-600">
                                  <Icon name="QrCode" size={16} />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handlePrintForm(doc)} className="bg-zinc-700 border-zinc-600 text-white hover:bg-zinc-600">
                                  <Icon name="Printer" size={16} />
                                </Button>
                                <Button size="sm" onClick={() => handleIssueDocument(doc)} className="bg-green-900 hover:bg-green-800 text-white">
                                  <Icon name="Check" size={16} className="mr-1" />
                                  Выдать
                                </Button>
                                {canDeleteDocuments && (
                                  <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm(doc)}>
                                    <Icon name="Trash2" size={16} />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <Dialog open={showNewDocForm} onOpenChange={setShowNewDocForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-800 border-zinc-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Новый документ</DialogTitle>
            <DialogDescription className="text-zinc-400">Заполните анкету для приёма документа</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-zinc-300">Фамилия *</Label>
              <Input value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="bg-zinc-700 border-zinc-600 text-white" />
            </div>
            <div>
              <Label className="text-zinc-300">Имя *</Label>
              <Input value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="bg-zinc-700 border-zinc-600 text-white" />
            </div>
            <div>
              <Label className="text-zinc-300">Отчество</Label>
              <Input value={formData.middleName} onChange={(e) => setFormData({...formData, middleName: e.target.value})} className="bg-zinc-700 border-zinc-600 text-white" />
            </div>
            <div>
              <Label className="text-zinc-300">Телефон *</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="+7" className="bg-zinc-700 border-zinc-600 text-white" />
            </div>
            <div className="col-span-2">
              <Label className="text-zinc-300">Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="bg-zinc-700 border-zinc-600 text-white" />
            </div>
            <div className="col-span-2">
              <Label className="text-zinc-300">Описание предмета *</Label>
              <Textarea value={formData.itemDescription} onChange={(e) => setFormData({...formData, itemDescription: e.target.value})} rows={3} className="bg-zinc-700 border-zinc-600 text-white" />
            </div>
            <div>
              <Label className="text-zinc-300">Категория</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value as Document['category']})}>
                <SelectTrigger className="bg-zinc-700 border-zinc-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="documents">Документы</SelectItem>
                  <SelectItem value="photos">Фото</SelectItem>
                  <SelectItem value="cards">Карты</SelectItem>
                  <SelectItem value="other">Другое</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-zinc-300">Дата получения</Label>
              <Input type="date" value={formData.pickupDate} onChange={(e) => setFormData({...formData, pickupDate: e.target.value})} className="bg-zinc-700 border-zinc-600 text-white" />
            </div>
            <div>
              <Label className="text-zinc-300">Сумма при сдаче</Label>
              <Input type="number" value={formData.depositAmount} onChange={(e) => setFormData({...formData, depositAmount: e.target.value})} placeholder="0" className="bg-zinc-700 border-zinc-600 text-white" />
            </div>
            <div>
              <Label className="text-zinc-300">Сумма при получении</Label>
              <Input type="number" value={formData.pickupAmount} onChange={(e) => setFormData({...formData, pickupAmount: e.target.value})} placeholder="0" className="bg-zinc-700 border-zinc-600 text-white" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => handlePrintForm()} className="flex-1 bg-zinc-700 border-zinc-600 text-white hover:bg-zinc-600">
              <Icon name="Printer" className="mr-2" />
              Печать пустой анкеты
            </Button>
            <Button onClick={handleCreateDocument} className="flex-1 bg-black hover:bg-zinc-900">
              <Icon name="Check" className="mr-2" />
              Создать документ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="max-w-md text-center bg-zinc-800 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-white">QR Код документа</DialogTitle>
          </DialogHeader>
          {qrImage && (
            <div className="flex flex-col items-center gap-4">
              <img src={qrImage} alt="QR Code" className="w-64 h-64 rounded-lg border-4 border-zinc-700" />
              <Button onClick={() => {
                const link = document.createElement('a');
                link.download = 'qr-code.png';
                link.href = qrImage;
                link.click();
              }} className="bg-black hover:bg-zinc-900">
                <Icon name="Download" className="mr-2" />
                Скачать QR
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        <DialogContent className="max-w-lg bg-zinc-800 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-white">Сканер QR-кодов</DialogTitle>
            <DialogDescription className="text-zinc-400">Наведите камеру на QR-код или введите номер вручную</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <video ref={videoRef} className="w-full h-64 bg-black rounded-lg" />
            <canvas ref={canvasRef} className="hidden" />
            <div>
              <Label className="text-zinc-300">Или введите номер вручную</Label>
              <div className="flex gap-2">
                <Input 
                  value={scannedQR} 
                  onChange={(e) => setScannedQR(e.target.value)} 
                  placeholder="Введите 12-значный номер"
                  className="bg-zinc-700 border-zinc-600 text-white"
                  onKeyDown={(e) => e.key === 'Enter' && scannedQR && processScannedQR(scannedQR)}
                />
                <Button onClick={() => scannedQR && processScannedQR(scannedQR)} className="bg-black hover:bg-zinc-900">
                  <Icon name="Search" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-zinc-800 border-zinc-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Удалить документ?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Вы уверены, что хотите удалить документ {deleteConfirm?.qrCode}? Это действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-700 border-zinc-600 text-white hover:bg-zinc-600">Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDeleteDocument(deleteConfirm)} className="bg-red-900 hover:bg-red-800">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
