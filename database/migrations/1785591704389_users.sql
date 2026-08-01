-- Up Migration
-- User / account tables. Surrogate ids are `uuid` so opaque ids (JWTs, links)
-- do not leak account counts or ordering. OTP and refresh tokens are stored
-- only as hashes; the raw values never touch the database.
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    email text NOT NULL,
    name text,
    locale text NOT NULL DEFAULT 'mr',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_users_locale CHECK (locale IN ('mr', 'en')),
    CONSTRAINT ck_users_email CHECK (email <> '' AND position('@' IN email) > 1)
);

-- Case-insensitive uniqueness: the API must query `WHERE lower(email) = lower($1)`.
CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));

CREATE TABLE otp_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id uuid NOT NULL REFERENCES users (id),
    hashed_code text NOT NULL,
    channel text NOT NULL DEFAULT 'email',
    expires_at timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_otp_tokens_channel CHECK (channel IN ('email', 'sms')),
    CONSTRAINT ck_otp_tokens_attempts CHECK (attempts >= 0),
    CONSTRAINT ck_otp_tokens_hashed CHECK (hashed_code <> '')
);

-- Most-recent OTP per user (verification) + expiry cleanup scans.
CREATE INDEX idx_otp_tokens_user_created ON otp_tokens (user_id, created_at DESC);

CREATE INDEX idx_otp_tokens_expires_at ON otp_tokens (expires_at);

CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id uuid NOT NULL REFERENCES users (id),
    token_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked boolean NOT NULL DEFAULT FALSE,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_sessions_token_hash UNIQUE (token_hash),
    CONSTRAINT ck_sessions_expiry CHECK (expires_at > created_at)
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);

CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

CREATE TABLE favorites (
    user_id uuid NOT NULL REFERENCES users (id),
    panchayat_id bigint NOT NULL REFERENCES panchayats (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, panchayat_id)
);

CREATE INDEX idx_favorites_panchayat_id ON favorites (panchayat_id);

CREATE TABLE search_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id uuid NOT NULL REFERENCES users (id),
    query text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_search_history_query CHECK (query <> '')
);

CREATE INDEX idx_search_history_user_created ON search_history (user_id, created_at DESC);

-- `user_id` is nullable to allow anonymous feedback.
CREATE TABLE feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id uuid REFERENCES users (id),
    category text,
    message text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_feedback_message CHECK (message <> '')
);

CREATE INDEX idx_feedback_created_at ON feedback (created_at);

-- Down Migration
DROP TABLE IF EXISTS feedback;

DROP TABLE IF EXISTS search_history;

DROP TABLE IF EXISTS favorites;

DROP TABLE IF EXISTS sessions;

DROP TABLE IF EXISTS otp_tokens;

DROP TABLE IF EXISTS users;
