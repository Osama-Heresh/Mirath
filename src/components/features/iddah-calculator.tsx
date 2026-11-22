"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format } from "date-fns";
import { arSA } from "date-fns/locale";
import { CalendarDays, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import React, { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const IDDAH_DURATION_DAYS = 128; // Approximation: 4 lunar months and 10 days (4 * 29.53059 + 10 = 128.12236 days)

const FormSchema = z.object({
  deathDate: z.date({
    required_error: "الرجاء اختيار تاريخ وفاة الزوج.",
  }),
});

type IddahFormValues = z.infer<typeof FormSchema>;

export default function IddahCalculator() {
  const [iddahEndDate, setIddahEndDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Added for potential async ops in future
  const [error, setError] = useState<string | null>(null);

  const form = useForm<IddahFormValues>({
    resolver: zodResolver(FormSchema),
  });

  const onSubmit: SubmitHandler<IddahFormValues> = (data) => {
    setIsLoading(true);
    setError(null);
    setIddahEndDate(null);
    try {
      // The end date is the death date plus the duration minus one day,
      // as the death date is considered the first day of the Iddah period.
      const endDate = addDays(data.deathDate, IDDAH_DURATION_DAYS - 1);
      if (Number.isNaN(endDate.getTime())) {
        throw new Error("Calculated Iddah end date is invalid.");
      }
      setIddahEndDate(endDate);
    } catch (e) {
      console.error("Error calculating Iddah period:", e);
      setError("حدث خطأ أثناء حساب العدة. الرجاء التأكد من صحة التاريخ.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <CalendarDays className="h-7 w-7 text-primary" />
          حاسبة مدة العدة للأرملة
        </CardTitle>
        <CardDescription>
          أدخل تاريخ وفاة الزوج لحساب نهاية فترة العدة الشرعية (أربعة أشهر وعشرة أيام بشكل تقريبي).
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="deathDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel htmlFor="deathDate" className="text-lg">تاريخ وفاة الزوج</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          id="deathDate"
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal text-base p-3 h-auto focus:ring-accent",
                            !field.value && "text-muted-foreground"
                          )}
                          aria-label="اختر تاريخ وفاة الزوج"
                        >
                          <CalendarDays className="ml-2 h-5 w-5 opacity-70" />
                          {field.value ? (
                            format(field.value, "PPP", { locale: arSA })
                          ) : (
                            <span>اختر التاريخ</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                        locale={arSA}
                        dir="rtl"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex justify-start">
            <Button type="submit" disabled={isLoading} className="px-8 py-3 text-lg">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  جاري الحساب...
                </>
              ) : (
                "احسب مدة العدة"
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>

      {error && (
         <div className="p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>خطأ في الحساب</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {iddahEndDate && !error && (
        <div className="p-6">
           <Alert variant="default" className="bg-primary/10 border-primary/30">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary">تم حساب مدة العدة بنجاح!</AlertTitle>
            <AlertDescription>
              تنتهي فترة العدة التقريبية في:{" "}
              <span className="font-semibold">
                {format(iddahEndDate, "PPP", { locale: arSA })} ({format(iddahEndDate, "eeee", { locale: arSA })})
              </span>.
              <br />
              <small className="text-muted-foreground">
                هذا الحساب تقريبي ويعتمد على مدة (4 أشهر قمرية و 10 أيام). للحساب الدقيق، يرجى الرجوع لأهل العلم.
              </small>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </Card>
  );
}
