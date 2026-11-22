import Header from '@/components/layout/header';
import InheritanceCalculator from '@/components/features/inheritance-calculator';
import IddahCalculator from '@/components/features/iddah-calculator';
import { Separator } from '@/components/ui/separator';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground">
      <div className="container mx-auto px-4">
        <Header />
        <main className="w-full max-w-4xl mx-auto space-y-12 mt-2 mb-16">
          <section id="inheritance-calculator" aria-labelledby="inheritance-title">
            <h2 id="inheritance-title" className="sr-only">حاسبة الميراث</h2>
            <InheritanceCalculator />
          </section>
          
          <Separator className="my-12 border-border/50" />
          
          <section id="iddah-calculator" aria-labelledby="iddah-title">
            <h2 id="iddah-title" className="sr-only">حاسبة العدة</h2>
            <IddahCalculator />
          </section>
        </main>
        <footer className="py-8 text-center text-muted-foreground text-sm border-t border-border/50">
          <p>&copy; {new Date().getFullYear()} الميراث الذكي. جميع الحقوق محفوظة.</p>
          <p className="mt-1">
            تنبيه: هذه الأداة للمساعدة والتثقيف فقط ولا تغني عن استشارة أهل العلم والاختصاص.
          </p>
        </footer>
      </div>
    </div>
  );
}
