import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const CUSTOMER_PROGRESS_KEYS = [
  "customerImport.progress.msg1",
  "customerImport.progress.msg2",
  "customerImport.progress.msg3",
  "customerImport.progress.msg4",
  "customerImport.progress.msg5",
];

const CONTACT_PROGRESS_KEYS = [
  "contactImport.progress.msg1",
  "contactImport.progress.msg2",
  "contactImport.progress.msg3",
  "contactImport.progress.msg4",
];

interface ImportProgressProps {
  importType: "customers" | "contacts";
  rowCount: number;
}

export function ImportProgress({ importType, rowCount }: ImportProgressProps) {
  const { t } = useTranslation();
  const ns = importType === "contacts" ? "contactImport" : "customerImport";
  const keys = importType === "contacts" ? CONTACT_PROGRESS_KEYS : CUSTOMER_PROGRESS_KEYS;
  const [messageIndex, setMessageIndex] = useState(0);
  const [fakeProgress, setFakeProgress] = useState(5);

  useEffect(() => {
    const msgInterval = setInterval(() => {
      setMessageIndex((prev) => (prev < keys.length - 1 ? prev + 1 : prev));
    }, 3000);

    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      setFakeProgress((prev) => {
        if (prev >= 99) return prev;

        let increment: number;
        let delay: number;

        if (prev < 30) {
          increment = 8;
          delay = 400;
        } else if (prev < 60) {
          increment = 4;
          delay = 500;
        } else if (prev < 90) {
          increment = 1.5;
          delay = 700;
        } else {
          increment = 1;
          delay = 2000;
        }

        const next = Math.min(99, prev + increment);
        timer = setTimeout(tick, delay);
        return next;
      });
    }

    timer = setTimeout(tick, 500);

    return () => {
      clearInterval(msgInterval);
      clearTimeout(timer);
    };
  }, [keys.length]);

  return (
    <Card variant="bordered" className="border-primary/20">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 text-primary animate-spin shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {t(`${ns}.progress.importing`, { count: rowCount })}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t(keys[messageIndex])}
            </p>
          </div>
        </div>
        <Progress value={fakeProgress} className="h-2" />
        <p className="text-xs text-muted-foreground text-center">
          {t(`${ns}.progress.doNotClose`)}
        </p>
      </CardContent>
    </Card>
  );
}
