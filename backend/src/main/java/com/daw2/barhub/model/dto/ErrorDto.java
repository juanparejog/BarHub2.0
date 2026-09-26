package com.daw2.barhub.model.dto;

import lombok.*;

@NoArgsConstructor
@AllArgsConstructor
@Data
@Getter
@Setter
public class ErrorDto {
    private String code;
    private String message;

    public static ErrorDto from(String message) {
        return new ErrorDto(null, message);
    }

    public static ErrorDto from(String code, String message) {
        return new ErrorDto(code, message);
    }
}