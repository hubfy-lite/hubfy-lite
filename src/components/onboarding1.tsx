"use client";

import { Check, ChevronLeft, Plus } from "lucide-react";
import { motion } from "motion/react";
import React, { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { WorkspaceAvatar } from "@/components/admin/WorkspaceAvatar";

interface Hyperlink {
  label: string;
  href: string;
}

interface StepComponentProps {
  onSubmit: () => void;
  goBack?: () => void;
  currentStep: number;
  totalSteps: number;
}

interface OnboardingStep {
  component: React.ComponentType<StepComponentProps>;
}

interface OnboardingStepHeaderProps {
  title: string;
  stepIndex: number;
  totalSteps: number;
  goBack?: () => void;
}

const OnboardingStepHeader = ({
  title,
  stepIndex,
  totalSteps,
  goBack,
}: OnboardingStepHeaderProps) => {
  return (
    <div className="relative">
      {goBack && stepIndex > 0 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={goBack}
          className="absolute top-1/2 right-full -translate-x-1/2 -translate-y-1/2"
        >
          <ChevronLeft className="size-4" />
        </Button>
      )}
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          {stepIndex + 1}/{totalSteps}
        </p>
        <h3 className="text-2xl font-semibold tracking-tight md:whitespace-nowrap">
          {title}
        </h3>
      </div>
    </div>
  );
};

interface OnboardingStepProps {
  children: React.ReactNode;
}

const OnboardingStep = ({ children }: OnboardingStepProps) => {
  return (
    <div className="flex w-full flex-col-reverse gap-10 sm:rounded-2xl sm:border md:min-h-[85dvh] md:flex-row lg:rounded-3xl">
      {children}
    </div>
  );
};

interface OnboardingStepLeftWrapperProps {
  title: string;
  currentStep: number;
  totalSteps: number;
  children: React.ReactNode;
  goBack?: () => void;
  /** Use fixed width (480px) instead of max-width on md+ */
  fixedWidth?: boolean;
}

const OnboardingStepLeftWrapper = ({
  title,
  currentStep,
  totalSteps,
  goBack,
  children,
  fixedWidth,
}: OnboardingStepLeftWrapperProps) => {
  return (
    <div className="flex min-w-0 flex-1/2 justify-center px-4 sm:py-10 sm:pb-10 sm:pl-10 sm:pr-10 md:py-20 lg:justify-start lg:pr-4 lg:pl-16">
      <div className={cn("flex h-full w-full flex-col gap-6", fixedWidth ? "md:w-[480px]" : "md:max-w-[480px]")}>
        <OnboardingStepHeader
          title={title}
          stepIndex={currentStep}
          totalSteps={totalSteps}
          goBack={goBack}
        />
        {children}
      </div>
    </div>
  );
};

interface OnboardingStepRightWrapperProps {
  children: React.ReactNode;
  className?: string;
}

const OnboardingStepRightWrapper = ({
  children,
  className,
}: OnboardingStepRightWrapperProps) => {
  return (
    <div
      className={cn(
        "hidden flex-1/2 overflow-hidden sm:pt-10 md:pt-20 lg:block",
        className,
      )}
    >
      {children}
    </div>
  );
};

interface FileInputProps {
  label: string;
  name: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  value: string | null;
  description?: string;
}

const FileInput = ({
  label,
  name,
  onChange,
  onRemove,
  value,
  description,
}: FileInputProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex items-center gap-4">
      <div
        onClick={handleUploadFile}
        className="flex size-18 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border bg-muted"
      >
        {value ? (
          <img
            src={value}
            alt="Profile picture"
            className="size-full object-cover"
          />
        ) : (
          <Plus />
        )}
      </div>
      <div className="space-y-3">
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
          <input
            type="file"
            name={name}
            ref={fileInputRef}
            className="hidden"
            onChange={onChange}
          />
          <Button
            variant="outline"
            type="button"
            size="sm"
            onClick={handleUploadFile}
          >
            Upload image
          </Button>
          {value && (
            <Button
              variant="outline"
              type="button"
              size="sm"
              onClick={onRemove}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
};

interface DashboardIllustrationProps {
  image?: string | null;
  iconName?: string | null;
  iconColor?: string | null;
  variant?: "zoomed-in" | "zoomed-out";
  title?: string;
  transformOrigin?: string;
  className?: string;
}

const DashboardIllustration = ({
  image,
  iconName,
  iconColor,
  variant = "zoomed-out",
  title = "Workspace title",
  transformOrigin = "-20%  -10%",
  className,
}: DashboardIllustrationProps) => {
  return (
    <motion.div
      style={{
        transformOrigin,
      }}
      animate={{
        scale: variant === "zoomed-in" ? 1.5 : 1,
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 40,
      }}
      className={cn(
        "flex h-full w-5xl overflow-hidden rounded-xl border",
        className,
      )}
    >
      <div className="h-full flex-2/7 shrink-0 overflow-hidden bg-muted">
        <div className="flex items-center justify-between gap-2 border-b p-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <WorkspaceAvatar
              iconUrl={image}
              iconName={iconName}
              iconColor={iconColor}
              size="md"
            />
            <p className="truncate overflow-hidden font-semibold">{title}</p>
          </div>
          <ChevronLeft className="size-4" />
        </div>
        <ul className="space-y-2 p-4">
          {Array.from({ length: 10 }).map((_, index) => (
            <li
              key={`sidebar-tab-${index}`}
              className="h-9 rounded-lg border bg-background/50 hover:shadow-md"
            />
          ))}
        </ul>
      </div>
      <div className="flex flex-5/7 shrink-0 flex-col justify-between p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="size-9 rounded-lg border bg-muted/50" />
              <div className="h-9 w-64 rounded-lg border bg-muted/50" />
              <div className="flex items-center gap-2">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div
                    key={`icon-btn-${index}`}
                    className="size-9 rounded-lg border"
                  />
                ))}
              </div>
            </div>
            <Button variant="outline">
              <span className="block h-5 w-20 rounded-md bg-muted/50" />
              <Plus />
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {[10, 40, 30, 60].map((width, index) => (
                    <TableHead
                      key={`th-${index}`}
                      style={{ width }}
                      className="h-9 border-r last:border-r-0"
                    />
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, rowIndex) => (
                  <TableRow
                    key={`row-${rowIndex}`}
                    className="even:bg-muted/20"
                  >
                    {Array.from({ length: 4 }).map((_, colIndex) => (
                      <TableCell
                        key={`cell-${rowIndex}-${colIndex}`}
                        className="h-9 border-r last:border-r-0"
                      />
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`icon-btn-${index}`}
              className="size-9 rounded-lg border bg-muted/50"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

interface FormFieldProps {
  label: string;
  placeholder: string;
  name: string;
  type?: string;
  input?: string;
  onChange?: React.ChangeEventHandler;
  options?: { label: string; value: string }[];
}

const FormField = ({
  label,
  placeholder,
  name,
  type,
  input = "input",
  onChange,
  options,
}: FormFieldProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {input === "textarea" && (
        <Textarea
          id={name}
          placeholder={placeholder}
          name={name}
          className="w-full"
          style={{
            resize: "none",
          }}
          onChange={onChange}
        />
      )}
      {input === "input" && (
        <Input
          type={type}
          id={name}
          placeholder={placeholder}
          name={name}
          className="w-full"
          onChange={onChange}
        />
      )}
      {input === "select" && (
        <Select>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

interface SkipOnboardingButtonProps {
  onSubmit: () => void;
  label: string;
  description: string;
}

const SkipOnboardingButton = ({
  onSubmit,
  label,
  description,
}: SkipOnboardingButtonProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="ghost">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setIsDialogOpen(false);
              onSubmit();
            }}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const StepOneComponent = ({
  onSubmit,
  currentStep,
  totalSteps,
}: StepComponentProps) => {
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePicture(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleRemoveImage = () => {
    setProfilePicture(null);
  };

  const TEXT_FIELDS = [
    {
      label: "Full name",
      placeholder: "Jane Smith",
      name: "name",
      type: "text",
    },
    {
      label: "Bio",
      placeholder: "A few words about yourself...",
      name: "about",
      type: "text",
      input: "textarea",
    },
    {
      label: "Work email",
      placeholder: "jane@company.com",
      name: "email",
      type: "email",
    },
  ];

  return (
    <OnboardingStep>
      <OnboardingStepLeftWrapper
        title="Set up your profile"
        currentStep={currentStep}
        totalSteps={totalSteps}
      >
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6 py-4">
          <FileInput
            label="Profile picture"
            name="profilePicture"
            onChange={handleFileUpload}
            onRemove={handleRemoveImage}
            value={profilePicture}
            description="*.png, *.jpeg files up to 10MB"
          />

          <div className="space-y-6 border-b pt-4 pb-6">
            {TEXT_FIELDS.map((field, i) => {
              return (
                <FormField
                  key={`text-field-${i}-${field.name}`}
                  label={field.label}
                  placeholder={field.placeholder}
                  name={field.name}
                  type={field.type}
                  input={field.input}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="space-y-1">
              <p className="font-medium">Send me product updates</p>
              <p className="text-muted-foreground">
                Stay informed about new features and improvements.
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <Button type="submit" onClick={onSubmit} className="mt-4 w-full">
            Continue
          </Button>
        </form>
      </OnboardingStepLeftWrapper>
      <OnboardingStepRightWrapper className="sm:pb-10 md:pb-20">
        <DashboardIllustration />
      </OnboardingStepRightWrapper>
    </OnboardingStep>
  );
};

const StepTwoComponent = ({
  currentStep,
  totalSteps,
  onSubmit,
  goBack,
}: StepComponentProps) => {
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [formValue, setFormValue] = useState<Record<string, string>>({});

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePicture(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleRemoveImage = () => {
    setProfilePicture(null);
  };

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormValue({ ...formValue, [e.target.name]: e.target.value });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValue({ ...formValue, [e.target.name]: e.target.value });
  };

  const TEXT_FIELDS = [
    {
      label: "Organization name",
      placeholder: "Acme Inc.",
      name: "companyName",
      type: "text",
      onChange: handleInputChange,
    },
    {
      label: "Workspace URL",
      placeholder: "acme",
      name: "workspaceHandle",
      type: "text",
      onChange: handleInputChange,
    },
    {
      label: "Country",
      placeholder: "Select your country",
      name: "billingCountry",
      input: "select",
      options: [
        { label: "United States", value: "us" },
        { label: "Canada", value: "ca" },
        { label: "United Kingdom", value: "uk" },
        { label: "Australia", value: "au" },
      ],
    },
    {
      label: "How did you find us?",
      placeholder: "Search engine, friend referral, social media...",
      name: "referralSource",
      type: "text",
      input: "textarea",
      onChange: handleTextAreaChange,
    },
  ];

  return (
    <OnboardingStep>
      <OnboardingStepLeftWrapper
        title="Set up your workspace"
        currentStep={currentStep}
        totalSteps={totalSteps}
        goBack={goBack}
      >
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6 py-4">
          <FileInput
            label="Workspace logo"
            name="workspaceLogo"
            onChange={handleFileUpload}
            onRemove={handleRemoveImage}
            value={profilePicture}
            description="*.png, *.jpeg files up to 10MB"
          />

          <div className="space-y-6 pt-4">
            {TEXT_FIELDS.map((field, i) => {
              return (
                <FormField
                  key={`text-field-${i}-${field.name}`}
                  label={field.label}
                  placeholder={field.placeholder}
                  name={field.name}
                  type={field.type}
                  input={field.input}
                  onChange={field.onChange}
                />
              );
            })}
          </div>

          <Button type="submit" onClick={onSubmit} className="mt-4 w-full">
            Continue
          </Button>
        </form>
      </OnboardingStepLeftWrapper>
      <OnboardingStepRightWrapper className="bg-gradient-to-b from-background to-muted">
        <DashboardIllustration
          variant="zoomed-in"
          image={profilePicture}
          title={formValue?.companyName}
        />
      </OnboardingStepRightWrapper>
    </OnboardingStep>
  );
};

const StepThreeComponent = ({
  currentStep,
  totalSteps,
  onSubmit,
  goBack,
}: StepComponentProps) => {
  const [mode, setMode] = useState<string>("pro");

  const modes = [
    {
      title: "Full sync",
      value: "pro",
      description:
        "Sync all contacts, events, and messages. Get the complete picture of your communications.",
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/block-1.svg",
    },
    {
      title: "Contacts only",
      value: "lite",
      description:
        "Only sync contact information. Ideal for privacy-conscious users.",
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/block-2.svg",
    },
  ];

  const features = [
    "Automatically import your existing contacts",
    "Keep your calendar events in sync across devices",
    "Get smart reminders based on your schedule",
  ];

  return (
    <OnboardingStep>
      <OnboardingStepLeftWrapper
        title="Connect your accounts"
        currentStep={currentStep}
        totalSteps={totalSteps}
        goBack={goBack}
      >
        <div className="space-y-8">
          <div className="space-y-3 text-sm">
            <p>
              Connect your accounts to unlock the full potential of your
              workspace. We&apos;ll help you stay organized and never miss a
              beat.
            </p>
            <ul className="space-y-1">
              {features.map((feature, i) => {
                return (
                  <li key={`feature-${i}`} className="flex items-center gap-2">
                    <Check className="size-4" />
                    <p>{feature}</p>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-3">
            {modes.map((m, i) => {
              return (
                <div
                  role="button"
                  key={`mode-${i}`}
                  onClick={() => setMode(m.value)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-4 text-xs",
                    m.value === mode
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50",
                  )}
                >
                  <img
                    src={m.image}
                    alt={m.title}
                    className="size-10 dark:invert"
                  />
                  <div>
                    <p className="font-medium">{m.title}</p>
                    <p className="text-muted-foreground">{m.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="w-full space-y-3">
            <Button className="w-full" onClick={onSubmit}>
              <img
                src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/google-icon.svg"
                alt="Google"
                className="size-4"
              />
              Connect with Google
            </Button>
            <Button className="w-full" onClick={onSubmit}>
              <img
                src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/facebook-icon.svg"
                alt="Microsoft"
                className="size-4"
              />
              Connect with Facebook
            </Button>
            <SkipOnboardingButton
              onSubmit={onSubmit}
              label="Skip this step"
              description="You can always connect your accounts later from the settings page."
            />
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Your data is secure and will never be shared with third parties.
          </p>
        </div>
      </OnboardingStepLeftWrapper>
      <OnboardingStepRightWrapper className="sm:pb-10 md:pb-20">
        <DashboardIllustration />
      </OnboardingStepRightWrapper>
    </OnboardingStep>
  );
};

const StepFourComponent = ({
  currentStep,
  totalSteps,
  onSubmit,
  goBack,
}: StepComponentProps) => {
  const [usecase, setUsecase] = useState<string | null>(null);

  const toggleUsecase = (i: string) => {
    setUsecase((prev) => (prev === i ? null : i));
  };

  const descriptions = [
    "We want to tailor your experience to match how you work best.",
    "Choose your primary use case below, and we'll set up templates, views, and shortcuts optimized for your workflow.",
  ];

  const usecases = [
    "Sales",
    "Recruiting",
    "Marketing",
    "Customer Success",
    "Support",
    "Engineering",
    "Product",
    "Design",
    "HR",
    "Legal",
    "Finance",
    "Operations",
    "Other",
  ];

  return (
    <OnboardingStep>
      <OnboardingStepLeftWrapper
        title="Tell us about your role"
        currentStep={currentStep}
        totalSteps={totalSteps}
        goBack={goBack}
      >
        <div className="flex h-full flex-col justify-between">
          <div className="space-y-6">
            <div className="space-y-2">
              {descriptions.map((description, i) => {
                return (
                  <p key={`description-${i}`} className="text-sm">
                    {description}
                  </p>
                );
              })}
            </div>

            <div className="space-y-2">
              <p className="text-sm">What best describes your work?</p>
              <div className="flex flex-wrap items-center gap-2">
                {usecases.map((u, i) => {
                  return (
                    <div
                      key={`usecase-${i}`}
                      role="button"
                      className={cn(
                        "cursor-pointer rounded-lg border px-2 py-1 text-xs",
                        usecase === u
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50",
                      )}
                      onClick={() => toggleUsecase(u)}
                    >
                      {u}
                    </div>
                  );
                })}
              </div>
            </div>

            {usecase === "Other" && (
              <div className="space-y-2">
                <Label>Please specify your role</Label>
                <Input
                  type="text"
                  placeholder="e.g. Research, Administration..."
                />
              </div>
            )}
          </div>

          <Button onClick={onSubmit} className="w-full">
            Continue
          </Button>
        </div>
      </OnboardingStepLeftWrapper>
      <OnboardingStepRightWrapper className="sm:pb-10 md:pb-20">
        <DashboardIllustration />
      </OnboardingStepRightWrapper>
    </OnboardingStep>
  );
};

const StepFiveComponent = ({
  currentStep,
  totalSteps,
  onSubmit,
  goBack,
}: StepComponentProps) => {
  const descriptions = [
    "Great things happen when teams work together.",
    "Invite your colleagues to join your workspace. Share projects, collaborate in real-time, and keep everyone aligned on what matters most.",
  ];

  return (
    <OnboardingStep>
      <OnboardingStepLeftWrapper
        title="Invite your team"
        currentStep={currentStep}
        totalSteps={totalSteps}
        goBack={goBack}
      >
        <div className="flex h-full flex-col justify-between">
          <div className="space-y-8">
            <div className="space-y-2">
              {descriptions.map((description, i) => {
                return (
                  <p key={`description-${i}`} className="text-sm">
                    {description}
                  </p>
                );
              })}
            </div>

            <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
              <div className="space-y-4">
                <Label>Enter email addresses</Label>
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={`input-${i}`} className="flex items-center gap-2">
                      <Input type="email" placeholder="example@email.com" />
                      <Select defaultValue="viewer">
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Button type="submit" className="w-full">
                  Send invites
                </Button>
                <SkipOnboardingButton
                  onSubmit={onSubmit}
                  label="Skip for now"
                  description="You can invite team members anytime from your workspace settings."
                />
              </div>
            </form>
          </div>

          <p className="text-xs text-muted-foreground">
            By continuing you agree to our Terms of Service and Privacy Policy.
            Invited members will receive an email with instructions to join your
            workspace.
          </p>
        </div>
      </OnboardingStepLeftWrapper>
      <OnboardingStepRightWrapper className="sm:pb-10 md:pb-20">
        <DashboardIllustration
          transformOrigin="180% -10%"
          variant="zoomed-in"
          className="-translate-x-1/4 xl:-translate-x-1/5 2xl:translate-x-0"
        />
      </OnboardingStepRightWrapper>
    </OnboardingStep>
  );
};

interface Onboarding1Props {
  className?: string;
  companyLogo?: string;
  copyright?: string;
  footerLinks?: Hyperlink[];
  steps?: OnboardingStep[];
}

const Onboarding1 = ({
  className,
  companyLogo = "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblocks-logo-word.svg",
  copyright = `© ${new Date().getFullYear()} ShadcnBlocks`,
  footerLinks = [
    { label: "Privacy Policy", href: "https://shadcnblocks.com" },
    {
      label: "Support",
      href: "https://shadcnblocks.com",
    },
    {
      label: "Sign out",
      href: "https://shadcnblocks.com",
    },
  ],
  steps = [
    {
      component: StepOneComponent,
    },
    {
      component: StepTwoComponent,
    },
    {
      component: StepThreeComponent,
    },
    {
      component: StepFourComponent,
    },
    {
      component: StepFiveComponent,
    },
  ],
}: Onboarding1Props) => {
  const [currentStep, setCurrentStep] = useState(0);

  const step = steps[currentStep];

  const handleSubmit = () => {
    if (currentStep !== steps.length - 1) setCurrentStep(currentStep + 1);
  };

  const handleGoBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  return (
    <section className="py-20">
      <div
        className={cn("container flex flex-col items-center gap-20", className)}
      >
        <img
          src={companyLogo}
          alt="Company Logo"
          className="w-54 dark:invert"
        />

        <step.component
          onSubmit={handleSubmit}
          currentStep={currentStep}
          totalSteps={steps.length}
          goBack={handleGoBack}
        />

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <p>{copyright}</p>
          {footerLinks.map((link) => (
            <a key={link.label} href={link.href} className="underline">
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export {
  Onboarding1,
  OnboardingStep,
  OnboardingStepHeader,
  OnboardingStepLeftWrapper,
  OnboardingStepRightWrapper,
  DashboardIllustration,
  FileInput,
  FormField,
};

export type { StepComponentProps };
