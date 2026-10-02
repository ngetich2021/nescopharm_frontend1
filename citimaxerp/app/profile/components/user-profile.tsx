import {ProfileCard} from "@/app/profile/components/profile-card";
import {ProfileSection} from "@/app/profile/components/profile-section";

interface UserProfileProps {
    user: {
        firstName: string;
        lastName: string;
        title: string;
        location: string;
        email: string;
        phone: string;
        bio: string;
        country: string;
        cityState: string;
        postalCode: string;
        taxId: string;
        avatar: string;
    };
    onEditProfile: () => void;
    onEditPersonalInfo: () => void;
    onEditAddress: () => void;
}

export function UserProfile({
                                user,
                                onEditProfile,
                                onEditPersonalInfo,
                                onEditAddress
                            }: UserProfileProps) {
    return (
        <div className="flex-1 p-4 sm:p-6">
            <h1 className="text-xl font-semibold text-gray-800 mb-6 sm:mb-8">My Profile</h1>

            <ProfileCard
                avatar={user.avatar}
                firstName={user.firstName}
                lastName={user.lastName}
                title={user.title}
                location={user.location}
                onEdit={onEditProfile}
            />

            <ProfileSection
                title="Personal Information"
                fields={[
                    { label: 'First Name', value: user.firstName },
                    { label: 'Last Name', value: user.lastName },
                    { label: 'Email address', value: user.email },
                    { label: 'Phone', value: user.phone },
                    { label: 'Bio', value: user.bio, spanFull: true }
                ]}
                onEdit={onEditPersonalInfo}
            />

            <ProfileSection
                title="Address"
                fields={[
                    { label: 'Country', value: user.country },
                    { label: 'City/State', value: user.cityState },
                    { label: 'Postal Code', value: user.postalCode },
                    { label: 'TAX ID', value: user.taxId }
                ]}
                onEdit={onEditAddress}
            />
        </div>
    );
}
