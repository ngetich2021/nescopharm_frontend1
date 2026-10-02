// components/profile/ProfileCard.tsx
import { Edit2 } from 'lucide-react';

interface ProfileCardProps {
    avatar: string;
    firstName: string;
    lastName: string;
    title: string;
    location: string;
    onEdit: () => void;
}

export function ProfileCard({
                                avatar,
                                firstName,
                                lastName,
                                title,
                                location,
                                onEdit
                            }: ProfileCardProps) {
    return (
        <div className="bg-white border border-gray-200 rounded-md mb-6">
            <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <img src={avatar} alt="Profile" className="rounded-full w-16 h-16 sm:w-20 sm:h-20" />
                    <div>
                        <h2 className="text-lg sm:text-xl font-semibold">{`${firstName} ${lastName}`}</h2>
                        <p className="text-gray-500 text-sm sm:text-base">{title}</p>
                        <p className="text-gray-500 text-xs sm:text-sm">{location}</p>
                    </div>
                </div>
                <button
                    onClick={onEdit}
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm self-end sm:self-auto"
                >
                    <Edit2 className="h-4 w-4" /> Edit
                </button>
            </div>
        </div>
    );
}
