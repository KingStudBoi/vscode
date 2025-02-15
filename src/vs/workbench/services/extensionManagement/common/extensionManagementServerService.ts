/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IExtensionManagementServer, IExtensionManagementServerService } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { IRemoteAgentService } from 'vs/workbench/services/remote/common/remoteAgentService';
import { Schemas } from 'vs/base/common/network';
import { IChannel } from 'vs/base/parts/ipc/common/ipc';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { ILabelService } from 'vs/platform/label/common/label';
import { isWeb } from 'vs/base/common/platform';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { WebExtensionManagementService } from 'vs/workbench/services/extensionManagement/common/webExtensionManagementService';
import { IExtension } from 'vs/platform/extensions/common/extensions';
import { WebRemoteExtensionManagementService } from 'vs/workbench/services/extensionManagement/common/remoteExtensionManagementService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { getTargetPlatformFromOS, IExtensionGalleryService, TargetPlatform } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IProductService } from 'vs/platform/product/common/productService';
import { IExtensionManifestPropertiesService } from 'vs/workbench/services/extensions/common/extensionManifestPropertiesService';
import { ILogService } from 'vs/platform/log/common/log';
import { getErrorMessage } from 'vs/base/common/errors';

export class ExtensionManagementServerService implements IExtensionManagementServerService {

	declare readonly _serviceBrand: undefined;

	readonly localExtensionManagementServer: IExtensionManagementServer | null = null;
	readonly remoteExtensionManagementServer: IExtensionManagementServer | null = null;
	readonly webExtensionManagementServer: IExtensionManagementServer | null = null;

	constructor(
		@IRemoteAgentService remoteAgentService: IRemoteAgentService,
		@ILabelService labelService: ILabelService,
		@IExtensionGalleryService galleryService: IExtensionGalleryService,
		@IProductService productService: IProductService,
		@IConfigurationService configurationService: IConfigurationService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IExtensionManifestPropertiesService extensionManifestPropertiesService: IExtensionManifestPropertiesService,
		@ILogService logService: ILogService,
	) {
		const remoteAgentConnection = remoteAgentService.getConnection();
		if (remoteAgentConnection) {
			const extensionManagementService = new WebRemoteExtensionManagementService(remoteAgentConnection.getChannel<IChannel>('extensions'), galleryService, configurationService, productService, extensionManifestPropertiesService);
			let remoteTargetPlatform = TargetPlatform.UNKNOWN;
			remoteAgentService.getEnvironment().then(remoteEnvironment => {
				if (remoteEnvironment) {
					remoteTargetPlatform = getTargetPlatformFromOS(remoteEnvironment.os, remoteEnvironment.arch);
				}
			}, error => logService.error('Error while resolving remote target platform', getErrorMessage(error)));
			this.remoteExtensionManagementServer = {
				id: 'remote',
				extensionManagementService,
				get label() { return labelService.getHostLabel(Schemas.vscodeRemote, remoteAgentConnection!.remoteAuthority) || localize('remote', "Remote"); },
				get targetPlatform() { return remoteTargetPlatform; }
			};
		}
		if (isWeb) {
			const extensionManagementService = instantiationService.createInstance(WebExtensionManagementService);
			this.webExtensionManagementServer = {
				id: 'web',
				extensionManagementService,
				label: localize('browser', "Browser"),
				targetPlatform: TargetPlatform.WEB,
			};
		}
	}

	getExtensionManagementServer(extension: IExtension): IExtensionManagementServer {
		if (extension.location.scheme === Schemas.vscodeRemote) {
			return this.remoteExtensionManagementServer!;
		}
		if (this.webExtensionManagementServer) {
			return this.webExtensionManagementServer;
		}
		throw new Error(`Invalid Extension ${extension.location}`);
	}
}

registerSingleton(IExtensionManagementServerService, ExtensionManagementServerService);
