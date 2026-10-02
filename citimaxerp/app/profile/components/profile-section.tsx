// components/profile/ProfileSection.tsx
import { Edit2 } from 'lucide-react';

interface ProfileSectionProps {
    title: string;
    fields: Array<{
        label: string;
        value: string;
        spanFull?: boolean;
    }>;
    onEdit: () => void;
}

export function ProfileSection({ title, fields, onEdit }: ProfileSectionProps) {
    return (
        <div className="bg-white border border-gray-200 rounded-md mb-6">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-medium text-gray-800 text-sm sm:text-base">{title}</h3>
                <button
                    onClick={onEdit}
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs sm:text-sm"
                >
                    <Edit2 className="h-3 w-3 sm:h-4 sm:w-4" /> Edit
                </button>
            </div>
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-4 sm:gap-y-6">
                {fields.map((field, index) => (
                    <div key={index} className={field.spanFull ? 'sm:col-span-2' : ''}>
                        <p className="text-xs sm:text-sm text-gray-500 mb-1">{field.label}</p>
                        <p className="text-gray-700 text-sm sm:text-base">{field.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
