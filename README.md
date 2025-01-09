# Unity Built-In PBR Texture Converter

A web-based tool that converts PBR texture maps (Albedo, Roughness, Metallic, and Normal) to Unity's Standard Built-In Shader format.

## Features

- The red channel is used for Metallic, and the alpha channel is used for Smoothness.
- Option to manually generate missing Roughness and Metallic maps with customizable values.
- Resize the output textures to a desired resolution (e.g., 512x512, 1024x1024).
- Generates a zip file containing the converted textures.
- Names texture by following template: T_YourSetName_Albedo.png

## Usage
  Download repository and open PBRToUnityBuiltIn.html in your browser. Make sure .css and .js in same folder.

## Contributing
  If you'd like to contribute to this project, feel free to fork the repository, make changes, and submit a pull request.

## License
  This project is licensed under the MIT License - see the LICENSE file for details.
