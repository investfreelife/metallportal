"use client";
import { useState } from "react";
import { Plus, Trash2, GripVertical, Eye, EyeOff, Save } from "lucide-react";

interface MenuItem {
  id: string; label: string; href: string; visible: boolean; children?: MenuItem[];
}

const DEFAULT_MENU: MenuItem[] = [
  { id: "1", label: "Металлопрокат", href: "/catalog/metalloprokat", visible: true,
    children: [
      { id: "1-1", label: "Трубы и профиль", href: "/catalog/metalloprokat/truby-i-profil", visible: true },
      { id: "1-2", label: "Арматура и сетка", href: "/catalog/metalloprokat/armatura-i-setka", visible: true },
      { id: "1-3", label: "Балки и швеллеры", href: "/catalog/metalloprokat/balki-i-shvellery", visible: true },
      { id: "1-4", label: "Листы и плиты", href: "/catalog/metalloprokat/listy-i-plity", visible: true },
      { id: "1-5", label: "Уголки и полосы", href: "/catalog/metalloprokat/ugolki-i-polosy", visible: true },
    ]
  },
  { id: "2", label: "Конструкции", href: "/catalog/konstruktsii", visible: true },
  { id: "3", label: "Заборы", href: "/catalog/zabory", visible: true },
  { id: "4", label: "Здания", href: "/catalog/zdaniya", visible: true },
  { id: "5", label: "Под заказ", href: "/catalog/zakaz", visible: true },
];

export default function AdminMenu() {
  const [menu, setMenu] = useState<MenuItem[]>(DEFAULT_MENU);
  const [saved, setSaved] = useState(false);

  const toggle = (id: string) => {
    setMenu(m => m.map(item =>
      item.id === id ? { ...item, visible: !item.visible } :
      { ...item, children: item.children?.map(c => c.id === id ? { ...c, visible: !c.visible } : c) }
    ));
  };

  const updateLabel = (id: string, label: string) => {
    setMenu(m => m.map(item =>
      item.id === id ? { ...item, label } :
      { ...item, children: item.children?.map(c => c.id === id ? { ...c, label } : c) }
    ));
  };

  const updateHref = (id: string, href: string) => {
    setMenu(m => m.map(item =>
      item.id === id ? { ...item, href } :
      { ...item, children: item.children?.map(c => c.id === id ? { ...c, href } : c) }
    ));
  };

  const addItem = () => {
    const id = Date.now().toString();
    setMenu(m => [...m, { id, label: "Новый пункт", href: "/catalog", visible: true }]);
  };

  const removeItem = (id: string) => {
    setMenu(m => m.filter(item => item.id !== id).map(item => ({
      ...item, children: item.children?.filter(c => c.id !== id)
    })));
  };

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  const Row = ({ item, indent = false }: { item: MenuItem; indent?: boolean }) => (
    <div className={`flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-[#16213e] ${indent ? "ml-6" : ""} mb-1`}>
      <GripVertical size={14} className="text-white/20 cursor-grab flex-shrink-0" />
      <input value={item.label} onChange={e => updateLabel(item.id, e.target.value)}
        className="bg-[#0d0d1a] border border-white/20 rounded px-2 py-1 text-sm text-white outline-none focus:border-[#E8B86D] w-40" />
      <input value={item.href} onChange={e => updateHref(item.id, e.target.value)}
        className="bg-[#0d0d1a] border border-white/20 rounded px-2 py-1 text-sm text-white/60 outline-none focus:border-[#E8B86D] flex-1 font-mono text-xs" />
      <button onClick={() => toggle(item.id)} className="p-1.5 rounded transition-colors">
        {item.visible ? <Eye size={14} className="text-green-400" /> : <EyeOff size={14} className="text-white/20" />}
      </button>
      <button onClick={() => removeItem(item.id)} className="p-1.5 rounded text-white/20 hover:text-red-400 transition-colors">
        <Trash2 size={14} />
      </button>
    </div>
  );

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Навигация</h1>
        <div className="flex gap-3">
          <button onClick={addItem}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/20 text-white/60 hover:text-white text-sm">
            <Plus size={14} /> Добавить
          </button>
          <button onClick={save}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E8B86D] text-black font-bold text-sm">
            <Save size={14} /> {saved ? "Сохранено ✓" : "Сохранить"}
          </button>
        </div>
      </div>

      <div className="mb-4 text-sm text-white/40 bg-[#16213e] rounded-lg p-3 border border-white/10">
        Перетащите пункты для изменения порядка. Нажмите глаз для скрытия.
      </div>

      <div>
        {menu.map(item => (
          <div key={item.id}>
            <Row item={item} />
            {item.children?.map(child => <Row key={child.id} item={child} indent />)}
          </div>
        ))}
      </div>

      <div className="mt-6 bg-[#16213e] rounded-xl p-5 border border-white/10">
        <h3 className="text-white/60 text-sm font-semibold mb-3">Предпросмотр структуры</h3>
        <div className="text-sm text-white/40 font-mono">
          {menu.filter(i => i.visible).map(item => (
            <div key={item.id}>
              <div className="text-[#E8B86D]">▶ {item.label} ({item.href})</div>
              {item.children?.filter(c => c.visible).map(c => (
                <div key={c.id} className="ml-4 text-white/30">└ {c.label} ({c.href})</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
