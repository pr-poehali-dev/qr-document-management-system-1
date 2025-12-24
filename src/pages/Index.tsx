import { useState, useEffect } from 'react';
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
import Icon from '@/components/ui/icon';
import QRCode from 'qrcode';

type UserRole = 'client' | 'cashier' | 'admin' | 'creator' | 'nikitovsky' | 'head-cashier' | null;

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

const PASSWORDS: Record<string, string> = {
  cashier: '25',
  admin: '2025',
  creator: '202505',
  nikitovsky: '20252025',
  'head-cashier': '202520',
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
  const [loginStep, setLoginStep] = useState<'role' | 'auth'>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [archivedDocuments, setArchivedDocuments] = useState<Document[]>([]);
  const [showNewDocForm, setShowNewDocForm] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archivePassword, setArchivePassword] = useState('');
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [selectedQR, setSelectedQR] = useState('');
  const [qrImage, setQrImage] = useState('');
  
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
    if (role === 'nikitovsky') {
      setCurrentRole('nikitovsky');
      toast.success('Вход выполнен как Никитовский');
      return;
    }
    setSelectedRole(role as UserRole);
    setLoginStep('auth');
  };

  const handleLogin = () => {
    if (lockoutTime && Date.now() < lockoutTime) {
      const remaining = Math.ceil((lockoutTime - Date.now()) / 1000);
      toast.error(`Вход заблокирован. Осталось ${remaining} секунд`);
      return;
    }

    if (selectedRole && PASSWORDS[selectedRole] === password) {
      setCurrentRole(selectedRole);
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
    setUsername('');
    setPassword('');
    setShowArchive(false);
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

  const generateDocumentNumber = (category: Document['category']): string => {
    const categoryDocs = documents.filter(d => d.category === category);
    const number = categoryDocs.length + 1;
    const prefix = category.substring(0, 3).toUpperCase();
    return `${prefix}-${String(number).padStart(4, '0')}`;
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

    const docNumber = generateDocumentNumber(formData.category);
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
      createdBy: username || currentRole || 'system',
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

    toast.success(`Документ ${docNumber} создан`);
    setQrImage(qrImageData);
    setShowQRDialog(true);
  };

  const handleIssueDocument = (doc: Document) => {
    const updatedDoc = { ...doc, status: 'archived' as const };
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
    setArchivedDocuments(prev => [...prev, updatedDoc]);
    toast.success(`Документ ${doc.qrCode} выдан и перемещён в архив`);
    
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(`Номер ${doc.qrCode}`);
      utterance.lang = 'ru-RU';
      speechSynthesis.speak(utterance);
    }
  };

  const handleShowQR = async (qrCode: string) => {
    const qrImageData = await generateQR(qrCode);
    setQrImage(qrImageData);
    setShowQRDialog(true);
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
    };
    return names[role || ''] || '';
  };

  const canCreateDocuments = currentRole && ['cashier', 'admin', 'creator', 'nikitovsky', 'head-cashier'].includes(currentRole);
  const canViewArchive = currentRole && ['admin', 'creator', 'nikitovsky'].includes(currentRole);

  if (!currentRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 bg-primary rounded-full flex items-center justify-center mb-4">
              <Icon name="FileText" size={40} className="text-white" />
            </div>
            <CardTitle className="text-3xl font-bold">QR Документы</CardTitle>
            <CardDescription>Система управления документами</CardDescription>
          </CardHeader>
          <CardContent>
            {loginStep === 'role' ? (
              <div className="space-y-3">
                <Button onClick={() => handleRoleSelect('client')} className="w-full h-14 text-lg" variant="outline">
                  <Icon name="User" className="mr-2" />
                  Покупатель
                </Button>
                <Button onClick={() => handleRoleSelect('cashier')} className="w-full h-14 text-lg" variant="outline">
                  <Icon name="Calculator" className="mr-2" />
                  Кассир
                </Button>
                <Button onClick={() => handleRoleSelect('head-cashier')} className="w-full h-14 text-lg" variant="outline">
                  <Icon name="Crown" className="mr-2" />
                  Главный кассир
                </Button>
                <Button onClick={() => handleRoleSelect('admin')} className="w-full h-14 text-lg" variant="outline">
                  <Icon name="Shield" className="mr-2" />
                  Администратор
                </Button>
                <Button onClick={() => handleRoleSelect('creator')} className="w-full h-14 text-lg" variant="outline">
                  <Icon name="Settings" className="mr-2" />
                  Создатель
                </Button>
                <Button onClick={() => handleRoleSelect('nikitovsky')} className="w-full h-14 text-lg" variant="outline">
                  <Icon name="Star" className="mr-2" />
                  Никитовский
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Имя пользователя</Label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Введите имя" />
                </div>
                <div>
                  <Label>Пароль</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Введите пароль" />
                </div>
                {lockoutTime && Date.now() < lockoutTime && (
                  <p className="text-sm text-red-600">Блокировка: {Math.ceil((lockoutTime - Date.now()) / 1000)} сек</p>
                )}
                <div className="flex gap-2">
                  <Button onClick={() => setLoginStep('role')} variant="outline" className="flex-1">
                    Назад
                  </Button>
                  <Button onClick={handleLogin} className="flex-1" disabled={lockoutTime !== null && Date.now() < lockoutTime}>
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

  if (showArchive) {
    if (archivePassword !== PASSWORDS.archive) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Доступ к архиву</CardTitle>
              <CardDescription>Введите пароль архива</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input type="password" value={archivePassword} onChange={(e) => setArchivePassword(e.target.value)} placeholder="Пароль" />
              <div className="flex gap-2">
                <Button onClick={() => setShowArchive(false)} variant="outline" className="flex-1">Назад</Button>
                <Button onClick={() => {
                  if (archivePassword === PASSWORDS.archive) {
                    toast.success('Доступ к архиву открыт');
                  } else {
                    toast.error('Неверный пароль');
                  }
                }} className="flex-1">Открыть</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-800">Архив документов</h1>
              <p className="text-gray-600 mt-2">Все операции сохранены навсегда</p>
            </div>
            <Button onClick={() => { setShowArchive(false); setArchivePassword(''); }} variant="outline">
              <Icon name="ArrowLeft" className="mr-2" />
              Назад
            </Button>
          </div>

          <Card>
            <CardContent className="p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>QR Код</TableHead>
                    <TableHead>ФИО</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead>Предмет</TableHead>
                    <TableHead>Дата сдачи</TableHead>
                    <TableHead>Дата выдачи</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedDocuments.map(doc => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-mono">{doc.qrCode}</TableCell>
                      <TableCell>{`${doc.lastName} ${doc.firstName} ${doc.middleName}`}</TableCell>
                      <TableCell>{doc.phone}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{doc.category}</Badge>
                      </TableCell>
                      <TableCell>{doc.itemDescription}</TableCell>
                      <TableCell>{new Date(doc.depositDate).toLocaleDateString('ru-RU')}</TableCell>
                      <TableCell>{new Date().toLocaleDateString('ru-RU')}</TableCell>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <Icon name="FileText" size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">QR Документы</h1>
              <p className="text-sm text-gray-600">{getRoleName(currentRole)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canViewArchive && (
              <Button onClick={() => setShowArchive(true)} variant="outline">
                <Icon name="Archive" className="mr-2" />
                Архив
              </Button>
            )}
            <Button onClick={handleLogout} variant="outline">
              <Icon name="LogOut" className="mr-2" />
              Выход
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Управление документами</h2>
            <p className="text-gray-600 mt-2">Текущих документов: {documents.length}</p>
          </div>
          {canCreateDocuments && (
            <Button onClick={() => setShowNewDocForm(true)} size="lg" className="shadow-lg">
              <Icon name="Plus" className="mr-2" />
              Новый документ
            </Button>
          )}
        </div>

        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">Все ({documents.length})</TabsTrigger>
            <TabsTrigger value="documents">Документы ({documents.filter(d => d.category === 'documents').length}/{CATEGORY_LIMITS.documents})</TabsTrigger>
            <TabsTrigger value="photos">Фото ({documents.filter(d => d.category === 'photos').length}/{CATEGORY_LIMITS.photos})</TabsTrigger>
            <TabsTrigger value="cards">Карты ({documents.filter(d => d.category === 'cards').length}/{CATEGORY_LIMITS.cards})</TabsTrigger>
            <TabsTrigger value="other">Другое ({documents.filter(d => d.category === 'other').length})</TabsTrigger>
          </TabsList>

          {['all', 'documents', 'photos', 'cards', 'other'].map(tab => (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardContent className="p-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>QR Код</TableHead>
                        <TableHead>ФИО</TableHead>
                        <TableHead>Телефон</TableHead>
                        <TableHead>Предмет</TableHead>
                        <TableHead>Дата сдачи</TableHead>
                        <TableHead>Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents
                        .filter(doc => tab === 'all' || doc.category === tab)
                        .map(doc => (
                          <TableRow key={doc.id}>
                            <TableCell className="font-mono font-semibold">{doc.qrCode}</TableCell>
                            <TableCell>{`${doc.lastName} ${doc.firstName}`}</TableCell>
                            <TableCell>{doc.phone}</TableCell>
                            <TableCell className="max-w-xs truncate">{doc.itemDescription}</TableCell>
                            <TableCell>{new Date(doc.depositDate).toLocaleDateString('ru-RU')}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleShowQR(doc.qrCode)}>
                                  <Icon name="QrCode" size={16} />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handlePrintForm(doc)}>
                                  <Icon name="Printer" size={16} />
                                </Button>
                                <Button size="sm" onClick={() => handleIssueDocument(doc)}>
                                  <Icon name="Check" size={16} className="mr-1" />
                                  Выдать
                                </Button>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новый документ</DialogTitle>
            <DialogDescription>Заполните анкету для приёма документа</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Фамилия *</Label>
              <Input value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} />
            </div>
            <div>
              <Label>Имя *</Label>
              <Input value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} />
            </div>
            <div>
              <Label>Отчество</Label>
              <Input value={formData.middleName} onChange={(e) => setFormData({...formData, middleName: e.target.value})} />
            </div>
            <div>
              <Label>Телефон *</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="+7" />
            </div>
            <div className="col-span-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="col-span-2">
              <Label>Описание предмета *</Label>
              <Textarea value={formData.itemDescription} onChange={(e) => setFormData({...formData, itemDescription: e.target.value})} rows={3} />
            </div>
            <div>
              <Label>Категория</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value as Document['category']})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="documents">Документы</SelectItem>
                  <SelectItem value="photos">Фото</SelectItem>
                  <SelectItem value="cards">Карты</SelectItem>
                  <SelectItem value="other">Другое</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Дата получения</Label>
              <Input type="date" value={formData.pickupDate} onChange={(e) => setFormData({...formData, pickupDate: e.target.value})} />
            </div>
            <div>
              <Label>Сумма при сдаче</Label>
              <Input type="number" value={formData.depositAmount} onChange={(e) => setFormData({...formData, depositAmount: e.target.value})} placeholder="0" />
            </div>
            <div>
              <Label>Сумма при получении</Label>
              <Input type="number" value={formData.pickupAmount} onChange={(e) => setFormData({...formData, pickupAmount: e.target.value})} placeholder="0" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => handlePrintForm()} className="flex-1">
              <Icon name="Printer" className="mr-2" />
              Печать пустой анкеты
            </Button>
            <Button onClick={handleCreateDocument} className="flex-1">
              <Icon name="Check" className="mr-2" />
              Создать документ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="max-w-md text-center">
          <DialogHeader>
            <DialogTitle>QR Код документа</DialogTitle>
          </DialogHeader>
          {qrImage && (
            <div className="flex flex-col items-center gap-4">
              <img src={qrImage} alt="QR Code" className="w-64 h-64" />
              <Button onClick={() => {
                const link = document.createElement('a');
                link.download = 'qr-code.png';
                link.href = qrImage;
                link.click();
              }}>
                <Icon name="Download" className="mr-2" />
                Скачать QR
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
