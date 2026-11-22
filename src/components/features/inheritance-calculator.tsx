
"use client";

import type { CalculateInheritanceInput, CalculateInheritanceOutput } from "@/ai/flows/calculate-inheritance";
import { calculateInheritance } from "@/ai/flows/calculate-inheritance";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, AlertTriangle, CheckCircle2, Users, BookOpenText, Printer, Coins } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const FormSchema = z.object({
  familyDetails: z.string().min(10, { message: "الرجاء إدخال تفاصيل كافية عن الأسرة (10 أحرف على الأقل)." }),
  totalEstateValue: z.preprocess(
    (val) => (val === "" || val === undefined || val === null || Number.isNaN(parseFloat(String(val))) ? undefined : parseFloat(String(val))),
    z.number({invalid_type_error: "الرجاء إدخال رقم صحيح لقيمة التركة."}).positive({message: "قيمة التركة يجب أن تكون موجبة."}).optional()
  ),
});

type InheritanceFormValues = z.infer<typeof FormSchema>;

export default function InheritanceCalculator() {
  const [result, setResult] = useState<CalculateInheritanceOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedEstateValue, setSubmittedEstateValue] = useState<number | undefined>(undefined);

  const form = useForm<InheritanceFormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      familyDetails: "",
      totalEstateValue: undefined,
    },
  });

  const familyDetailsWatcher = form.watch("familyDetails");

  useEffect(() => {
    const currentFamilyDetails = familyDetailsWatcher;
    let newEstateValue: number | undefined = undefined;

    if (currentFamilyDetails && currentFamilyDetails.trim() !== "") {
      let totalCalculatedCurrencyValue = 0;
      const currencyPattern = /([\d,]+(?:\.\d+)?)\s*(?:دينار|دنانير|درهم|دراهم|ريال|ريالات|د\.أ|جنية|جنيهات|دينار اردني)/gi;
      currencyPattern.lastIndex = 0;
      let match;

      while ((match = currencyPattern.exec(currentFamilyDetails)) !== null) {
        const numericValue = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(numericValue) && numericValue > 0) {
          totalCalculatedCurrencyValue += numericValue;
        }
      }

      if (totalCalculatedCurrencyValue > 0) {
        newEstateValue = totalCalculatedCurrencyValue;
      } else {
        const numberPattern = /([\d,]+(?:\.\d+)?)/g;
        numberPattern.lastIndex = 0;
        const standaloneMatches = currentFamilyDetails.match(numberPattern);
        if (standaloneMatches && standaloneMatches.length > 0) {
           // Try to find a number not immediately preceded or followed by characters that suggest it's not a standalone value
           // This is a heuristic. A more robust NLP approach would be needed for perfect extraction.
          const potentialValues = standaloneMatches.map(sm => parseFloat(sm.replace(/,/g, '')));
          // Filter out potential year numbers or very small numbers if others are large, simple heuristic
          const filteredValues = potentialValues.filter(v => !isNaN(v) && v > 0 && (v > 1000 || potentialValues.length === 1));
          if (filteredValues.length > 0) {
            // Prefer larger values if multiple are found without currency, or simply the first one.
            newEstateValue = Math.max(...filteredValues); // Or simply filteredValues[0]
          }
        }
      }
    }
    
    const currentFormValueString = form.getValues("totalEstateValue")?.toString();
    const currentFormValue = currentFormValueString === "" || currentFormValueString === undefined ? undefined : parseFloat(currentFormValueString);

    if (newEstateValue !== currentFormValue) {
         form.setValue("totalEstateValue", newEstateValue, {
            shouldValidate: true,
            shouldDirty: newEstateValue !== undefined, // Only dirty if we are setting a value
            shouldTouch: true
        });
    }


  }, [familyDetailsWatcher, form]);


  const onSubmit: SubmitHandler<InheritanceFormValues> = async (data) => {
    setIsLoading(true);
    setResult(null);
    setError(null);
    setSubmittedEstateValue(data.totalEstateValue);
    try {
      const input: CalculateInheritanceInput = { 
        familyDetails: data.familyDetails,
        totalEstateValue: data.totalEstateValue,
      };
      const response = await calculateInheritance(input);
      if (!response.ok) {
        console.error("Error calculating inheritance:", {
          statusCode: response.statusCode,
          error: response.error,
        });
        setError(response.error);
        return;
      }
      if (!response.data || !Array.isArray(response.data.heirs)) {
        const invalidResponseError = new Error("Invalid or empty response received from calculateInheritance.");
        console.error(invalidResponseError, response);
        setError("حدث خطأ أثناء حساب الميراث. الرجاء التأكد من المدخلات والمحاولة مرة أخرى. قد يكون السبب هو تعقيد الحالة المقدمة أو خطأ في تفسير البيانات من قبل الذكاء الاصطناعي.");
        return;
      }
      setResult(response.data);
    } catch (e) {
      console.error("Error calculating inheritance:", e);
      setError("حدث خطأ أثناء حساب الميراث. الرجاء التأكد من المدخلات والمحاولة مرة أخرى. قد يكون السبب هو تعقيد الحالة المقدمة أو خطأ في تفسير البيانات من قبل الذكاء الاصطناعي.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.error("Error triggering print dialog:", e);
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value).replace('ر.س.', 'دينار');
  };
  
  const formatPercentage = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    // Ensure two decimal places, e.g., 16.67%, 50.00%
    return `${value.toFixed(2)}%`;
  }

  let processedHeirs = result?.heirs;
  if (result && result.heirs && result.heirs.length > 0) {
    const relationshipCounter: { [key: string]: number } = {};
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  
    const toArabicNumeral = (num: number): string => {
      if (num === 0) return arabicNumerals[0]; // Should ideally not be 0 for 1-based count
      return num.toString().split('').map(digit => arabicNumerals[parseInt(digit)]).join('');
    };
  
    const relationshipTotals: { [key: string]: number } = {};
    result.heirs.forEach(heir => {
      relationshipTotals[heir.relationship] = (relationshipTotals[heir.relationship] || 0) + 1;
    });
  
    const commonGenericNames = [
      "الزوج", "الزوجة", "الابن", "البنت", "الأم", "الأب", "الجد", "الجدة", 
      "الأخ الشقيق", "الأخت الشقيقة", "الأخ لأب", "الأخت لأب", "الأخ لأم", "الأخت لأم",
      "ابن الابن", "بنت الابن", "ابن الأخ الشقيق", "ابن الأخ لأب", "العم الشقيق", "العم لأب"
    ];
  
    processedHeirs = result.heirs.map(heir => {
      let newName = heir.name;
      if (relationshipTotals[heir.relationship] > 1) {
        if (commonGenericNames.includes(heir.name)) {
          relationshipCounter[heir.relationship] = (relationshipCounter[heir.relationship] || 0) + 1;
          newName = `${heir.name} ${toArabicNumeral(relationshipCounter[heir.relationship])}`;
        }
      }
      return { ...heir, name: newName };
    });
  }


  return (
    <Card className="w-full shadow-lg print:shadow-none print:border-none" id="inheritance-calculator-card">
      <CardHeader className="print:hidden">
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Users className="h-7 w-7 text-primary" />
          حاسبة الميراث الشرعي
        </CardTitle>
        <CardDescription>
          أدخل تفاصيل أسرة المتوفى وأي وصايا موجودة. يمكنك أيضاً إدخال قيمة التركة الإجمالية (اختياري) لعرض قيمة حصة كل وريث.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="print:hidden">
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="familyDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="familyDetails" className="text-lg">تفاصيل الأسرة والوصية (باللغة العربية)</FormLabel>
                  <FormControl>
                    <Textarea
                      id="familyDetails"
                      placeholder="مثال: توفي رجل وترك زوجة، ابنين، وبنت، وترك 15000 دينار. أوصى بثلث ماله للفقراء..."
                      className="min-h-[150px] resize-y text-base p-3 focus:ring-accent"
                      {...field}
                      aria-label="تفاصيل الأسرة والوصية"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="totalEstateValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="totalEstateValue" className="text-lg flex items-center gap-2">
                    <Coins className="h-5 w-5 text-muted-foreground" />
                    قيمة التركة الإجمالية (بالدينار - اختياري)
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="totalEstateValue"
                      type="number"
                      placeholder="مثال: 100000 (سيتم محاولة ملئه تلقائياً من النص أعلاه)"
                      className="text-base p-3 focus:ring-accent"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                      value={field.value ?? ''}
                      aria-label="قيمة التركة الإجمالية بالدينار"
                      step="any"
                    />
                  </FormControl>
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
                "احسب الميراث"
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>

      {error && (
        <div className="p-6 print:hidden">
          <Alert variant="destructive">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>خطأ في الحساب</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {result && !error && (
        <div className="p-6 space-y-6" id="printableInheritanceResults">
          <Alert variant="default" className="bg-primary/10 border-primary/30 print:hidden">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary">تم حساب الميراث بنجاح!</AlertTitle>
            <AlertDescription>النتائج مبنية على المعلومات المقدمة وتفسير الذكاء الاصطناعي للنصوص الشرعية.</AlertDescription>
          </Alert>
          
          <div className="print:pt-0">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-semibold text-primary flex items-center gap-2">
                <BookOpenText className="h-6 w-6" />
                جدول الأنصبة:
                </h3>
                <Button onClick={handlePrint} variant="outline" className="print:hidden">
                    <Printer className="ml-2 h-5 w-5" />
                    اطبع النتائج
                </Button>
            </div>
            {processedHeirs && processedHeirs.length > 0 ? (
              <div className="overflow-x-auto rounded-md border print:border-gray-300">
                <Table>
                  <TableHeader className="bg-muted print:bg-gray-100">
                    <TableRow>
                      <TableHead className="w-[20%] text-right font-semibold print:text-black">الوارث</TableHead>
                      <TableHead className="w-[20%] text-right font-semibold print:text-black">الصلة</TableHead>
                      <TableHead className="w-[20%] text-right font-semibold print:text-black">النصيب الشرعي</TableHead>
                      <TableHead className="w-[20%] text-right font-semibold print:text-black">النسبة المئوية</TableHead>
                      {submittedEstateValue !== undefined && submittedEstateValue > 0 && (
                        <TableHead className="w-[20%] text-right font-semibold print:text-black">قيمة الحصة (دينار)</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedHeirs.map((heir, index) => (
                      <TableRow key={index} className={`${index % 2 === 0 ? "bg-background" : "bg-muted"} print:bg-white print:text-black print:border-b print:border-gray-300`}>
                        <TableCell className="font-medium">{heir.name}</TableCell>
                        <TableCell>{heir.relationship}</TableCell>
                        <TableCell>{heir.shareText}</TableCell>
                        <TableCell>{formatPercentage(heir.sharePercentage)}</TableCell>
                        {submittedEstateValue !== undefined && submittedEstateValue > 0 && (
                          <TableCell>
                            {heir.sharePercentage !== undefined && heir.sharePercentage !== null
                              ? formatCurrency((heir.sharePercentage / 100) * submittedEstateValue)
                              : '-'}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground print:text-black">لا يوجد ورثة بناءً على المدخلات.</p>
            )}
          </div>

          {result.notes && (
            <div className="print:pt-4">
              <h3 className="text-xl font-semibold mb-3 text-primary print:text-black">ملاحظات إضافية:</h3>
              <p className="whitespace-pre-wrap bg-muted/30 p-4 rounded-md text-foreground leading-relaxed print:bg-transparent print:p-0 print:text-black print:border print:border-gray-300 print:leading-normal">
                {result.notes}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

