'use client'

import { useEffect, useMemo, useState } from 'react';
import { useSelector,useDispatch } from 'react-redux';
import { fetchEntries } from '@/redux/slices/entrySlice';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';

export default function ProfilePage() {
    const dispatch = useDispatch();
    const { user } = useSelector((state) => state.auth);
    const {orgs, activeOrg } = useSelector((state) => state.orgs);
    const { entries, loading } = useSelector((state) => state.entries);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        if (activeOrg) {
            dispatch(fetchEntries({orgId: activeOrg, page: 1, limit: 5}));
        }
    }, [activeOrg, dispatch]);

    const myEntries = useMemo(() => {
        return entries.filter(e => e.authorId === user._id);
    }, [entries, user._id]);

    const stats = useMemo(() => {
        const totalUpvotes = myEntries.reduce((sum, e) => sum + (e.upvotes?.length || 0), 0);
        const totalDownvotes = myEntries.reduce((sum, e) => sum + (e.downvotes?.length || 0), 0);
        
        const typeCounts = {};
        myEntries.forEach(e => {
            typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
        });

        const favoriteType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

        return { totalEntries: myEntries.length,
            totalUpvotes, totalDownvotes, favoriteType: favoriteType ? favoriteType[0].replace('-', ' ') : '-' };
    }, [myEntries]);

    if (loading) {
        return <Skeleton count={5} />;
    }

    return (
        <div className="max-w-2xl space-y-6">
            <div className="card-base">
                <h2 className="text-2xl font-bold text-primary">My Profile</h2>
                <p className="text-secondary">{user.name} ({user.email})</p>
            </div>
            <div className="card-base">
                <h3 className="text-lg font-semibold text-primary mb-4">My Stats</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted rounded">
                        <p className="text-sm text-secondary">Total Entries</p>
                        <p className="text-2xl font-bold text-primary">{stats.totalEntries}</p>
                    </div>
                    <div className="p-4 bg-muted rounded">
                        <p className="text-sm text-secondary">Total Upvotes</p>
                        <p className="text-2xl font-bold text-primary">{stats.totalUpvotes}</p>
                    </div>
                    <div className="p-4 bg-muted rounded">
                        <p className="text-sm text-secondary">Total Downvotes</p>
                        <p className="text-2xl font-bold text-primary">{stats.totalDownvotes}</p>
                    </div>
                    <div className="p-4 bg-muted rounded">  
                        <p className="text-sm text-secondary">Favorite Type</p>
                        <p className="text-2xl font-bold text-primary">{stats.favoriteType}</p>
                    </div>
                </div>
            </div>
            <div className="card-base">
                <h3 className="text-lg font-semibold text-primary mb-4">My Recent Entries</h3>
                <div className="space-y-3">
                    {myEntries.length === 0 ? (
                        <p className="text-secondary">You haven't created any entries yet.</p>
                    ) : (
                        myEntries.map(entry => (
                            <Link key={entry._id} href={`/dashboard/entries/${entry._id}`} className="block p-3 rounded bg-[#1a1a27] hover:bg-[#252530] transition">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-primary font-medium">{entry.title}</h4>
                                    <Badge>{entry.type.replace('-', ' ')}</Badge>
                                </div>
                                <p className="text-sm text-secondary truncate">{entry.content}</p>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}