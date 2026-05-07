export const LANGS = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'yo', label: 'Yoruba',  flag: '🇳🇬' },
  { code: 'ig', label: 'Igbo',    flag: '🇳🇬' },
  { code: 'ha', label: 'Hausa',   flag: '🇳🇬' },
];

export const TRANS_LANGS = LANGS.filter((l) => l.code !== 'en');

export const CATEGORIES = [
  { id: 'children',     label: 'Children',     color: '#F97316', range: 'Ages 4 – 11' },
  { id: 'intermediate', label: 'Intermediate', color: '#10B981', range: 'Ages 12 – 17' },
  { id: 'youth',        label: 'Youth',        color: '#2563EB', range: 'Ages 18 – 25' },
  { id: 'adult',        label: 'Adult',        color: '#7C3AED', range: '26 & above' },
];

export const CAT_PILL = {
  children:     'orange',
  intermediate: 'teal',
  youth:        'blue',
  adult:        'violet',
};

// Translatable app strings, grouped for the Translations page.
// Each entry is "key:English fallback" — the English value is shown beside the
// key as a placeholder hint while the user fills in the target language.
export const TRANS_KEYS = {
  Greetings: [
    'good_morning:Good morning',
    'good_afternoon:Good afternoon',
    'good_evening:Good evening',
    'learner:Learner',
    'health_tagline:Your learning journey continues today.',
  ],
  Sections: [
    'age_group:Age Group',
    'recent_lessons:Recent Lessons',
    'recently_visited:Recently Visited',
    'quick_access:Quick Actions',
    'view_all:View All →',
    'start_quiz:Start Quiz',
    'no_lessons:No lessons yet',
    'loading:Loading…',
  ],
  'Quick Access': [
    'notes:Notes',
    'notes_sub:Your class notes',
    'lessons:Lessons',
    'lessons_sub:Browse all units',
    'language:Language',
    'language_sub:EN · YO · IG · HA',
    'devotional:Devotional',
    'devotional_sub:Daily reading plan',
  ],
  Categories: [
    'cat_adult:Adult',
    'cat_youth:Youth',
    'cat_intermediate:Intermediate',
    'cat_children:Children',
    'cat_adult_range:26 & above',
    'cat_youth_range:Ages 18 – 25',
    'cat_intermediate_range:Ages 12 – 17',
    'cat_children_range:Ages 4 – 11',
  ],
  'Tab Bar': [
    'tab_home:Home',
    'tab_lessons:Lessons',
    'tab_notes:Notes',
    'tab_settings:Settings',
  ],
  Subscription: [
    'subscribe_title:Subscribe to Unlock',
    'subscribe_sub:Choose a plan to access your lessons',
    'plan_single:Single Category',
    'plan_all:All Categories',
    'plan_single_tagline:One age group of your choice',
    'plan_all_tagline:Every age group unlocked',
    'pay_now:Subscribe Now',
    'select_plan:Select a plan above',
    'select_category:Select a category above',
    'pay_button:Pay',
    'category_locked:Category Locked',
    'category_locked_msg:Your plan only covers your selected category.',
    'upgrade:Upgrade to All Categories',
  ],
  Settings: [
    'settings:Settings',
    'my_learning:My Learning',
    'progress_scores:Progress & Scores',
    'quiz_results:Quiz results and stats',
    'lesson_library:Lesson Library',
    'lesson_library_sub:Browse all Sunday School lessons',
    'lang_label:Language',
    'appearance:Appearance',
    'dark_mode:Dark Mode',
    'light_mode:Light Mode',
    'switch_theme:Switch app theme',
    'notifications:Notifications',
    'account:Account',
    'edit_profile:Edit Profile',
    'edit_profile_sub:Name, avatar, church',
    'change_password:Change Password',
    'change_password_sub:Update your login password',
    'sign_out:Sign Out',
    'sign_out_sub:Sign out of this device',
    'delete_account:Delete Account',
    'delete_account_sub:Permanently remove data',
    'about:About',
    'about_app:About App',
    'website:Website',
    'reminderTime:REMINDER TIME',
  ],
  Account: [
    'my_account:My Account',
    'subscribed_category:Subscribed Category',
    'subscription_details:Subscription Details',
    'plan_type:Plan Type',
    'status:Status',
    'expires_on:Expires On',
    'days_remaining:Days Remaining',
    'active:Active',
    'expired:Expired',
    'renew:Renew Subscription',
    'extend:Extend Subscription',
    'your_plan:Your Plan',
  ],
};

export const ALL_TRANS_KEY_NAMES = Object.values(TRANS_KEYS)
  .flat()
  .map((kv) => kv.split(':')[0]);
