export interface UnkeyAuthRequest {
	key: string;
}

export interface UnkeyAuthResponse {
	valid: boolean;
	ownerId: string;
	meta: any;
}
