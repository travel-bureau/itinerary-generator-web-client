"use client";
import * as React from "react"
import { Check } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import VideoPlayer from "@/custom/VideoPlayer";

const apiUrl = import.meta.env.PUBLIC_API_URL;
const videoURL = "https://storage.googleapis.com/itinerary-generator-videos/itinerary_generator.webm";

async function fetchWithRetry(payload, retries = 5) {
  const isDev = import.meta.env.NODE_ENV === 'development';

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${apiUrl}/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        return await res;
      } else if (isDev) {
        console.warn(`🔁 Retry ${i + 1}/${retries} — status: ${res.status}`);
      }
    } catch (err) {
      if (isDev) {
        console.warn(`⚠️ Retry ${i + 1}/${retries} — network error: ${err.message}`);
      }
    }

    await new Promise((r) => setTimeout(r, 5000 * (i + 1)));
  }

  throw new Error('GraphQL endpoint failed after retries');
}

function calculateTripDays(fromDate: Date, toDate: Date): number {
  if (!fromDate || !toDate) return 50;
  const diffMs = toDate.getTime() - fromDate.getTime();
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

const Contact17 = () => {
  const form = useForm({
    defaultValues: {
      title: "",
      destination: "",
      name: "",
      pax: "",
      fromDate: "",
      toDate: "",
      days: "",
      inclusions: "",
      exclusions: "",
      approximateCost: ""
    },
    shouldUnregister: true,
  });

  const [fromOpen, setFromDateOpen] = React.useState(false)
  const [fromDate, setFromDate] = React.useState<Date | undefined>(undefined)
  const [toOpen, setToDateOpen] = React.useState(false)
  const [toDate, setToDate] = React.useState<Date | undefined>(undefined)

  const [dayBlocks, setDayBlocks] = React.useState([{ uid: crypto.randomUUID() }]);
  const [costBlocks, setCostBlocks] = React.useState([{ uid: crypto.randomUUID() }]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [useCache, setUseCache] = React.useState(true);
  const [fromDateValue, setFromDateValue] = React.useState<Date | null>(null);
  const [maxDays, setMaxDays] = React.useState(50);

  const selectedDays = parseInt(form.watch("days") || "0", 10);
  const { toast } = useToast();

  const addDayBlock = () => {
    setDayBlocks([...dayBlocks, { uid: crypto.randomUUID() }]);
  };

  const deleteDayBlock = (uid: string) => {
    if (dayBlocks.length === 1) return; // always keep one
    setDayBlocks(dayBlocks.filter((block) => block.uid !== uid));
  };

  const addCostBlock = () => {
    if (costBlocks.length >= 10) return;
    setCostBlocks([...costBlocks, { uid: crypto.randomUUID() }]);
  };

  const deleteCostBlock = (uid: string) => {
    if (costBlocks.length === 1) return; // always keep one
    setCostBlocks(costBlocks.filter((block) => block.uid !== uid));
  };

  const onSubmit = async (data: Record<string, any>) => {
    const {
      title,
      destination,
      name,
      pax,
      fromDate,
      toDate,
      days,
      inclusions,
      exclusions,
      approximateCost,
      ...rest
    } = data;

    // Extract cost blocks
    const costBlocks = Object.entries(rest)
      .reduce((acc, [key, value]) => {
        const match = key.match(/^cost-(.+)-(entity|details)$/);
        if (!match) return acc;
        const [_, uid, field] = match;
        acc[uid] = acc[uid] || {};
        acc[uid][field] = value;
        return acc;
      }, {} as Record<string, { entity: string; details: string }>);

    // Extract day blocks
    const dayBlocks = Object.entries(rest)
      .reduce((acc, [key, value]) => {
        const match = key.match(/^day-(.+)-(number|details)$/);
        if (!match) return acc;
        const [_, uid, field] = match;
        acc[uid] = acc[uid] || {};
        acc[uid][field] = value;
        return acc;
      }, {} as Record<string, { number: string; details: string }>);

    // Final structured output
    const output = {
      title,
      destination,
      name,
      pax,
      fromDate,
      toDate,
      days: Number(days),
      inclusions,
      exclusions,
      approximateCost: approximateCost?.trim() || "Not specified",
      costs: Object.values(costBlocks),
      itinerary: Object.values(dayBlocks).sort((a, b) => Number(a.number) - Number(b.number)),
      useCache,
    };

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    setIsGenerating(true);
    const payload = {
      query: `
        mutation createTripAndFetchPdf($input: CreateTripInput!) {
          createTripAndFetchPdf(input: $input)
        }
      `,
      variables: { input: output },
    };

    try {
      const response = await fetchWithRetry(payload);

      if (!response.ok) {
        const errorText = await response.text(); // fallback for non-JSON errors
        const vercelError = response.headers.get("x-vercel-error");
        const status = response.status;

        toast({
          variant: "destructive",
          title: "❌ PDF generation failed",
          description: vercelError
            ? `Server error (${status}): ${vercelError}`
            : `Unexpected server error (${status})`,
        });

        console.error("Server error:", {
          status,
          vercelError,
          body: errorText,
        });

        return;
      }

      const result = await response.json();

      if (Array.isArray(result.errors) && result.errors.length > 0) {
        const rawError = result.errors[0];
        const message =
          typeof rawError === "string"
            ? rawError
            : typeof rawError?.message === "string"
            ? rawError.message
            : "PDF generation failed";

        const prefix = message.includes("Int cannot") || message.includes("Field") ? "⚠️ " : "❌ ";
        toast({
          variant: "destructive",
          title: `${prefix} PDF generation failed`,
          description: message,
        });

        return;
      }

      const base64 = result.data?.createTripAndFetchPdf;

      if (!base64) {
        toast({
          variant: "destructive",
          title: "PDF generation failed",
          description: "No PDF data returned",
        });
        return;
      }

      const blob = new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
        type: "application/pdf",
      });

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "itinerary.pdf";
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();

      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("PDF download failed:", error);

      toast({
        variant: "destructive",
        title: "❌ PDF generation failed",
        description: (
          <>
            Network error or server unreachable.{" "}
            <a
              href="https://www.vercel-status.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-white hover:text-gray-200 font-medium"
            >
              Check live server status
            </a>
            .
          </>
        ),
      });

    } finally {
      setIsGenerating(false);
    }

  };

  const currentYear = new Date().getFullYear();
  const minDate = new Date(); // Current date
  const maxDate = new Date(currentYear + 1, 11, 31); // Dec 31, next year
  
  return (
    <section className="bg-muted/200 py-32">
      <div className="container">
        <div className="mt-8 grid grid-cols-1 gap-8 md:gap-10 lg:grid-cols-2 lg:grid-rows-[min-content_1fr]">
          <h2 className="order-1 text-4xl font-medium tracking-tight md:order-none md:text-5xl">
            Itinerary Generator
          </h2>
          <div className="order-2 md:order-none md:row-span-2">
            <div className="bg-background border-border rounded-lg border p-6">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="flex flex-col field-block"
                >
                  <div className="contents w-full">
                    <FormField
                      control={form.control}
                      name="title"
                      rules={{ required: "Title is required" }}
                      render={({ field, fieldState }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Dubai - 6 Days Trip"
                            />
                          </FormControl>
                          {fieldState.error && (
                            <p className="text-sm text-destructive mt-1">
                              {fieldState.error.message}
                            </p>
                          )}
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="destination"
                      rules={{ required: "Destination is required" }}
                      render={({ field, fieldState }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Destination</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Dubai"
                            />
                          </FormControl>
                          {fieldState.error && (
                            <p className="text-sm text-destructive mt-1">
                              {fieldState.error.message}
                            </p>
                          )}
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="name"
                      rules={{ required: "Name is required" }}
                      render={({ field, fieldState }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Ashok"
                            />
                          </FormControl>
                          {fieldState.error && (
                            <p className="text-sm text-destructive mt-1">
                              {fieldState.error.message}
                            </p>
                          )}
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="pax"
                      rules={{ required: "PAX is required" }}
                      render={({ field, fieldState }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>PAX</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="6 Adults + 3 Child (7, 3 year & 1 infant)"
                            />
                          </FormControl>
                          {fieldState.error && (
                            <p className="text-sm text-destructive mt-1">
                              {fieldState.error.message}
                            </p>
                          )}
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="fromDate"
                      rules={{ required: "Please select the from date" }}
                      render={({ field, fieldState }) => (
                        <FormItem>
                          <FormLabel>From Date</FormLabel>
                          <Popover open={fromOpen} onOpenChange={setFromDateOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <button
                                  type="button"
                                  className={`w-full px-3 py-2 text-left border rounded-md bg-background text-sm ${
                                    field.value ? "text-foreground" : "text-muted-foreground"
                                  }`}
                                >
                                  {field.value ? format(field.value, "dd MMM yyyy") : "Pick a date"}
                                </button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                captionLayout="dropdown"
                                disabled={(date) => date < minDate || date > maxDate}
                                startMonth={minDate}
                                endMonth={maxDate}
                                onSelect={(selectedDate) => {
                                  setFromDate(selectedDate);
                                  field.onChange(selectedDate);
                                  setFromDateValue(selectedDate); // ⬅️ triggers re-render of toDate
                                  setFromDateOpen(false);
                                  if (selectedDate && toDate) {
                                    const days = calculateTripDays(selectedDate, toDate);
                                    setMaxDays(days);
                                  }
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                          {fieldState.error && (
                              <p className="text-sm text-destructive mt-1">
                                {fieldState.error.message}
                              </p>
                            )}
                        </FormItem>
                      )}
                    />
                    <br />
                    <FormField
                      control={form.control}
                      name="toDate"
                      rules={{ required: "Please select the to date" }}
                      render={({ field, fieldState }) => {
                        return (
                          <FormItem>
                            <FormLabel>To Date</FormLabel>
                            <Popover open={toOpen} onOpenChange={setToDateOpen}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <button
                                    type="button"
                                    className={`w-full px-3 py-2 text-left border rounded-md bg-background text-sm ${
                                      field.value ? "text-foreground" : "text-muted-foreground"
                                    }`}
                                  >
                                    {field.value ? format(field.value, "dd MMM yyyy") : "Pick a date"}
                                  </button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={field.value || fromDateValue}
                                  month={fromDateValue} // ⬅️ This sets the initial view to fromDate's month
                                  captionLayout="dropdown"
                                  disabled={(date) => {
                                    const isBeforeFromDate = fromDateValue ? date < fromDateValue : false;
                                    const isOutsideRange = date < minDate || date > maxDate;
                                    return isBeforeFromDate || isOutsideRange;
                                  }}
                                  startMonth={minDate}
                                  endMonth={maxDate}
                                  onSelect={(selectedDate) => {
                                    setToDate(selectedDate);
                                    field.onChange(selectedDate);
                                    setToDateOpen(false);
                                    if (fromDate && selectedDate) {
                                      const days = calculateTripDays(fromDate, selectedDate);
                                      setMaxDays(days);
                                    };
                                  }}
                                />
                              </PopoverContent>
                            </Popover>
                            {fieldState.error && (
                              <p className="text-sm text-destructive mt-1">
                                {fieldState.error.message}
                              </p>
                            )}
                          </FormItem>
                        );
                      }}
                    />
                    <div className="col-span-2 space-y-4">
                      <h3 className="text-lg font-semibold">Day Details</h3>
                      <FormField
                        control={form.control}
                        name="days"
                        rules={{ required: "Please select the number of days" }}
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel>Number of days</FormLabel>
                            <FormControl>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select number of days" />
                                </SelectTrigger>
                                <SelectContent className="max-h-80 overflow-y-auto">
                                  {Array.from({ length: maxDays }, (_, i) => (
                                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                                      {i + 1}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            {fieldState.error && (
                              <p className="text-sm text-destructive mt-1">
                                {fieldState.error.message}
                              </p>
                            )}
                          </FormItem>
                        )}
                      />
                      <br />
                      {selectedDays > 0 && 
                        dayBlocks.map((block, index) => (
                        <div key={block.uid} className="space-y-2 border p-4 rounded-md relative">
                          <FormField
                            control={form.control}
                            name={`day-${block.uid}-number`}
                            rules={{
                              required: "Day number is required",
                              validate: (value) => {
                                const num = parseInt(value, 10);
                                if (isNaN(num)) return "Must be a number";
                                if (num < 1) return "Day must be at least 1";
                                if (num > selectedDays) return `Day cannot exceed ${selectedDays}`;
                                return true;
                              },
                            }}
                            render={({ field, fieldState }) => (
                              <FormItem>
                                <FormLabel>Day #</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="Enter day number"
                                    onKeyDown={(e) => {
                                      const key = e.key;

                                      // Allow navigation keys
                                      if (
                                        key === "Backspace" ||
                                        key === "Delete" ||
                                        key === "ArrowLeft" ||
                                        key === "ArrowRight" ||
                                        key === "Tab"
                                      ) {
                                        return;
                                      }

                                      // Allow only digits
                                      if (!/^\d$/.test(key)) {
                                        e.preventDefault();
                                        return;
                                      }

                                      // Predict resulting value
                                      const currentValue = e.currentTarget.value;
                                      const selectionStart = e.currentTarget.selectionStart ?? currentValue.length;
                                      const selectionEnd = e.currentTarget.selectionEnd ?? currentValue.length;

                                      const predictedValue =
                                        currentValue.slice(0, selectionStart) + key + currentValue.slice(selectionEnd);
                                      const predictedNumber = parseInt(predictedValue, 10);

                                      // Block if out of range
                                      if (isNaN(predictedNumber) || predictedNumber < 1 || predictedNumber > selectedDays) {
                                        e.preventDefault();
                                      }
                                    }}
                                  />
                                </FormControl>
                                {fieldState.error && (
                                  <p className="text-sm text-destructive mt-1">
                                    {fieldState.error.message}
                                  </p>
                                )}
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`day-${block.uid}-details`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Day Details</FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    placeholder="Describe activities for this day"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            {index === dayBlocks.length - 1 && dayBlocks.length < selectedDays && (
                              <Button type="button" onClick={addDayBlock} variant="default">
                                ➕ Add Day
                              </Button>
                            )}
                            {dayBlocks.length > 1 && (
                              <Button
                                type="button"
                                onClick={() => deleteDayBlock(block.uid)}
                                variant="destructive"
                              >
                                🗑️ Delete
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <br />
                    <div className="col-span-2 space-y-4">
                      <h3 className="text-lg font-semibold mt-6">Cost Details</h3>
                      {costBlocks.map((block, index) => (
                        <div key={block.uid} className="space-y-2 border p-4 rounded-md relative">
                          <FormField
                            control={form.control}
                            name={`cost-${block.uid}-entity`}
                            rules={{ required: "Cost entity is required" }}
                            render={({ field, fieldState }) => (
                              <FormItem>
                                <FormLabel>Cost Entity</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="e.g. Hotel, Transport, Meals"
                                  />
                                </FormControl>
                                {fieldState.error && (
                                  <p className="text-sm text-destructive mt-1">
                                    {fieldState.error.message}
                                  </p>
                                )}
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`cost-${block.uid}-details`}
                            rules={{ required: "Cost details are required" }}
                            render={({ field, fieldState }) => (
                              <FormItem>
                                <FormLabel>Cost Details</FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    placeholder="Describe the cost breakdown or notes"
                                  />
                                </FormControl>
                                {fieldState.error && (
                                  <p className="text-sm text-destructive mt-1">
                                    {fieldState.error.message}
                                  </p>
                                )}
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            {index === costBlocks.length - 1 && costBlocks.length < 10 && (
                              <Button type="button" onClick={addCostBlock} variant="default">
                                ➕ Add Cost
                              </Button>
                            )}
                            {costBlocks.length > 1 && (
                              <Button
                                type="button"
                                onClick={() => deleteCostBlock(block.uid)}
                                variant="destructive"
                              >
                                🗑️ Delete
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <FormField
                      control={form.control}
                      name="inclusions"
                      rules={{ required: "Inclusions are required" }}
                      render={({ field, fieldState }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Inclusions</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Provide the list of inclusions for this trip..."
                              className="min-h-[150px]" // 👈 Adjust height here
                            />
                          </FormControl>
                          {fieldState.error && (
                            <p className="text-sm text-destructive mt-1">
                              {fieldState.error.message}
                            </p>
                          )}
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="exclusions"
                      rules={{ required: "Exclusions are required" }}
                      render={({ field, fieldState }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Exclusions</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Provide the list of exclusions for this trip..."
                              className="min-h-[150px]" // 👈 Adjust height here
                            />
                          </FormControl>
                          {fieldState.error && (
                            <p className="text-sm text-destructive mt-1">
                              {fieldState.error.message}
                            </p>
                          )}
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="approximateCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Approximate Cost</FormLabel>
                          <FormControl>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select cost range" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="5k-15k">₹ 5K - ₹ 15K</SelectItem>
                                <SelectItem value="15k-30k">
                                  ₹ 15K - ₹ 30K
                                </SelectItem>
                                <SelectItem value="30k-50k">
                                  ₹ 30K - ₹ 50K
                                </SelectItem>
                                <SelectItem value="50k-100k">
                                  ₹ 50K - ₹ 100K
                                </SelectItem>
                                <SelectItem value="100k-250k">
                                  ₹ 100K - ₹ 250K
                                </SelectItem>
                                <SelectItem value="250k+">₹ 250K+</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="sm:col-span-2 flex flex-wrap gap-2 items-center">
                      <Button
                        type="submit"
                        disabled={isGenerating}
                        className={`flex-1 ${
                          isGenerating
                            ? 'bg-gradient-to-r from-green-500 to-green-700 animate-progress'
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        {isGenerating ? (
                          <span className="w-full text-center">Generating…</span>
                        ) : (
                          <span>Generate PDF</span>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setUseCache((prev) => !prev)}
                        className="flex-shrink-0"
                      >
                        {useCache ? '✅ Cache Enabled' : '🚫 Cache Disabled'}
                      </Button>
                    </div>

                    <p className="text-muted-foreground text-xs sm:col-span-2">
                      You acknowledge that you've reviewed and agreed to our{" "}
                      <a href="https://www.lovelytrails.com/privacy.php" target="_blank" className="text-primary hover:underline">
                        Privacy Policy
                      </a>{" "}
                      and{" "}
                      <a href="https://www.lovelytrails.com/tnc.php" target="_blank" className="text-primary hover:underline">
                        Terms of Service
                      </a>
                    </p>

                  </div>
                </form>
              </Form>
            </div>
          </div>
          <div className="order-3 my-6 md:order-none">
            <div className="mx-auto mt-12 max-w-6xl rounded-lg border p-2">
              <VideoPlayer videoURL={videoURL} />
            </div>
            <p className="my-6 font-bold">
              Share your itinerary details
            </p>
            <ul className="space-y-2 font-medium">
              <li className="flex items-center gap-2">
                <span className="bg-background flex size-6 shrink-0 items-center justify-center rounded-full">
                  <Check className="size-4" />
                </span>
                Title:
                <span className="italic text-accent">
                  Dubai - 6 Days Trip
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="bg-background flex size-6 shrink-0 items-center justify-center rounded-full">
                  <Check className="size-4" />
                </span>
                Name:
                <span className="italic text-accent">
                  Ashok
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="bg-background flex size-6 shrink-0 items-center justify-center rounded-full">
                  <Check className="size-4" />
                </span>
                Pax:
                <span className="italic text-accent">
                  6 Adults + 3 Child (7, 3 year & 1 infant)
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="bg-background flex size-6 shrink-0 items-center justify-center rounded-full">
                  <Check className="size-4" />
                </span>
                Date:
                <span className="italic text-accent">
                  03 Feb 2026 - 08 Feb 2026
                </span>
              </li>
            </ul>
            <p className="my-6 font-bold">
              Day wise details, cost, inclusions and exclusions
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Contact17 };
