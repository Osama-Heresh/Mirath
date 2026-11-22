import { Scale } from 'lucide-react';
import Link from 'next/link';

const Header = () => {
  return (
    <header className="w-full max-w-4xl pt-8 pb-4 text-center md:text-right">
      <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-3 text-primary">
        <Scale className="h-10 w-10 md:h-12 md:w-12" />
        <h1 className="text-3xl md:text-4xl font-bold">الميراث الذكي</h1>
      </div>
      <p className="mt-2 text-md md:text-lg text-muted-foreground">
        أداة لحساب الميراث الشرعي ومدة العدة بسهولة ودقة وفقًا لأحكام الشريعة الإسلامية.
      </p>
    </header>
  );
};

export default Header;
